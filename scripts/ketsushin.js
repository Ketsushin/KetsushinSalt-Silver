/**
 * Ketsushin: Salt & Silver
 * Modul-Initialisierung & CONFIG.DND5E Overrides
 */

// =============================================================================
// Währungsumrechnung – Kurse, Berechnungsfunktion & Dialog-Klasse
// =============================================================================

/**
 * Umrechnungskurse relativ zu EUR.
 * Bedeutung: wie viele Einheiten der Währung entsprechen 1 EUR.
 *   1 EUR = 1   USD
 *   1 EUR = 10  CNY
 *   1 EUR = 100 JPY
 *   1 EUR = 100 RUB
 */
const KS_EXCHANGE_RATES = {
  eur: 1,
  usd: 1.0,
  cny: 10.0,
  jpy: 100.0,
  rub: 100.0
};

/**
 * Rechnet einen Betrag von einer Währung in eine andere um.
 * Rechenweg: Quelle → EUR → Ziel (EUR als Anker).
 * Das Ergebnis wird abgerundet (keine Bruchteile).
 *
 * @param {number} amount - Quellbetrag (positiv, ganzzahlig)
 * @param {string} from   - Schlüssel der Quellwährung (z. B. "jpy")
 * @param {string} to     - Schlüssel der Zielwährung   (z. B. "usd")
 * @returns {number} Ganzzahliger Zielbetrag
 */
function ksConvertCurrency(amount, from, to) {
  if (from === to) return amount;
  const amountInEur = amount / KS_EXCHANGE_RATES[from];
  return Math.floor(amountInEur * KS_EXCHANGE_RATES[to]);
}

/**
 * Foundry-Dialog für den Währungs-Umtausch.
 * Öffnet ein Formular mit Von-/In-Dropdown und Mengen-Feld.
 * Zieht den Betrag vom aktiven Konto ab und schreibt das Ergebnis gut.
 */
class KetsushinExchangeDialog extends Dialog {
  /**
   * @param {Actor}         actor    - Der betroffene Charakter
   * @param {string}        mode     - "wallet" | "bank"
   * @param {Function|null} onUpdate - Callback nach erfolgreichem Tausch
   */
  constructor(actor, mode, onUpdate = null) {
    const opts = [
      { key: "eur", label: "€ EUR" },
      { key: "usd", label: "$ USD" },
      { key: "jpy", label: "¥ JPY" },
      { key: "cny", label: "¥ CNY" },
      { key: "rub", label: "₽ RUB" }
    ];
    const optHTML = opts.map(o => `<option value="${o.key}">${o.label}</option>`).join("");

    const content = `
      <form class="ks-exchange-form">
        <div class="ks-exchange-row">
          <div class="form-group">
            <label>Von Währung</label>
            <select name="from">${optHTML}</select>
          </div>
          <div class="form-group">
            <label>Menge</label>
            <input type="number" name="amount" min="1" step="1" value="1">
          </div>
          <div class="form-group">
            <label>In Währung</label>
            <select name="to">${optHTML}</select>
          </div>
        </div>
        <p class="ks-exchange-preview hint">Ergebnis: –</p>
      </form>`;

    super({
      title: `Geld wechseln (»${mode === "wallet" ? "Geldbörse" : "Bank"}«)`,
      content,
      buttons: {
        exchange: {
          icon: `<i class="fas fa-exchange-alt"></i>`,
          label: "Wechseln",
          callback: (html) => KetsushinExchangeDialog._onConfirm(html, actor, mode, onUpdate)
        },
        cancel: {
          icon: `<i class="fas fa-times"></i>`,
          label: "Abbrechen"
        }
      },
      default: "exchange",
      render:  (html) => KetsushinExchangeDialog._bindPreview(html)
    });

    this._actor    = actor;
    this._mode     = mode;
    this._onUpdate = onUpdate;
  }

  /** Bindet Live-Vorschau: aktualisiert die Ergebnis-Zeile bei jeder Änderung. */
  static _bindPreview(html) {
    const refresh = () => {
      const from   = html.find("[name='from']").val();
      const to     = html.find("[name='to']").val();
      const amount = parseInt(html.find("[name='amount']").val(), 10) || 0;
      if (from && to && amount > 0) {
        const result = ksConvertCurrency(amount, from, to);
        html.find(".ks-exchange-preview").text(`Ergebnis: ${result.toLocaleString()} ${to.toUpperCase()}`);
      } else {
        html.find(".ks-exchange-preview").text("Ergebnis: –");
      }
    };
    html.find("[name='from'], [name='to'], [name='amount']").on("input change", refresh);
    refresh();
  }

  /**
   * Führt den Tausch durch:
   *  1. Eingaben validieren
   *  2. Deckung prüfen
   *  3. Betrag abziehen, Ergebnis gutschreiben
   *  4. Flags aktualisieren
   *  5. onUpdate-Callback aufrufen
   */
  static async _onConfirm(html, actor, mode, onUpdate) {
    const MODULE_ID = "ketsushin-salt-silver";
    const from      = html.find("[name='from']").val();
    const to        = html.find("[name='to']").val();
    const amount    = parseInt(html.find("[name='amount']").val(), 10) || 0;

    if (!from || !to || amount <= 0) {
      ui.notifications.warn("Ketsushin | Ungültige Eingabe: Betrag muss größer als 0 sein.");
      return;
    }
    if (from === to) {
      ui.notifications.warn("Ketsushin | Quell- und Zielwährung sind identisch.");
      return;
    }

    const EMPTY = { eur: 0, usd: 0, jpy: 0, cny: 0, rub: 0 };
    const purse  = foundry.utils.deepClone(actor.getFlag(MODULE_ID, mode) ?? EMPTY);

    if ((purse[from] ?? 0) < amount) {
      ui.notifications.warn(
        `Ketsushin | Unzureichendes Guthaben: nur ${purse[from] ?? 0} ${from.toUpperCase()} verfügbar.`
      );
      return;
    }

    const converted = ksConvertCurrency(amount, from, to);
    purse[from]  -= amount;
    purse[to]     = (purse[to] ?? 0) + converted;

    await actor.setFlag(MODULE_ID, mode, purse);

    ui.notifications.info(
      `Ketsushin | ${amount.toLocaleString()} ${from.toUpperCase()} → ` +
      `${converted.toLocaleString()} ${to.toUpperCase()} gewechselt.`
    );

    onUpdate?.();
  }
}

// =============================================================================

Hooks.once("init", function () {
  console.log("Ketsushin: Salt & Silver | Modul wird initialisiert...");

  // -------------------------------------------------------------------------
  // Fertigkeiten (Skills)
  // Ersetzt alle Standard-D&D-Fertigkeiten vollständig.
  // Fähigkeitszuordnungen: str, dex, con, int, wis, cha
  // -------------------------------------------------------------------------
  CONFIG.DND5E.skills = {
    akr: { label: "Akrobatik",        ability: "dex", fullKey: "akrobatik" },
    ath: { label: "Athletik",          ability: "str", fullKey: "athletik" },
    auf: { label: "Auftreten",         ability: "cha", fullKey: "auftreten" },
    ein: { label: "Einschüchtern",     ability: "cha", fullKey: "einschuechtern" },
    erk: { label: "Erkunden",          ability: "wis", fullKey: "erkunden" },
    fin: { label: "Fingerfertigkeit",  ability: "dex", fullKey: "fingerfertigkeit" },
    hei: { label: "Heimlichkeit",      ability: "dex", fullKey: "heimlichkeit" },
    jag: { label: "Jagen",             ability: "wis", fullKey: "jagen" },
    med: { label: "Medizin",           ability: "wis", fullKey: "medizin" },
    mot: { label: "Motiv erkennen",    ability: "wis", fullKey: "motivErkennen" },
    nac: { label: "Nachforschungen",   ability: "int", fullKey: "nachforschungen" },
    nat: { label: "Naturkunde",        ability: "int", fullKey: "naturkunde" },
    alt: { label: "Alte Geschichte",   ability: "int", fullKey: "alteGeschichte" },
    rae: { label: "Rätsel",            ability: "int", fullKey: "raetsel" },
    tae: { label: "Täuschen",          ability: "cha", fullKey: "taeuschen" },
    rei: { label: "Reisen",            ability: "wis", fullKey: "reisen" },
    ueb: { label: "Überzeugen",        ability: "cha", fullKey: "ueberzeugen" },
    wah: { label: "Wahrnehmung",       ability: "wis", fullKey: "wahrnehmung" }
  };

  // -------------------------------------------------------------------------
  // Werkzeuge (Tool IDs)
  // Verweist auf Kompendium-Einträge dieses Moduls.
  // Platzhalter-UUIDs – müssen nach Kompendium-Erstellung aktualisiert werden.
  // -------------------------------------------------------------------------
  CONFIG.DND5E.toolIds = {
    alchemist:    "Compendium.ketsushin-salt-silver.items.Item.alchemist",
    brewer:       "Compendium.ketsushin-salt-silver.items.Item.brewer",
    calligrapher: "Compendium.ketsushin-salt-silver.items.Item.calligrapher",
    tinker:       "Compendium.ketsushin-salt-silver.items.Item.tinker",
    cartographer: "Compendium.ketsushin-salt-silver.items.Item.cartographer",
    cook:         "Compendium.ketsushin-salt-silver.items.Item.cook",
    mason:        "Compendium.ketsushin-salt-silver.items.Item.mason",
    jeweler:      "Compendium.ketsushin-salt-silver.items.Item.jeweler",
    glassblower:  "Compendium.ketsushin-salt-silver.items.Item.glassblower",
    leatherwork:  "Compendium.ketsushin-salt-silver.items.Item.leatherwork",
    cobbler:      "Compendium.ketsushin-salt-silver.items.Item.cobbler",
    painter:      "Compendium.ketsushin-salt-silver.items.Item.painter",
    potter:       "Compendium.ketsushin-salt-silver.items.Item.potter",
    smith:        "Compendium.ketsushin-salt-silver.items.Item.smith",
    carpenter:    "Compendium.ketsushin-salt-silver.items.Item.carpenter",
    weaver:       "Compendium.ketsushin-salt-silver.items.Item.weaver",
    woodcarver:   "Compendium.ketsushin-salt-silver.items.Item.woodcarver",
    mechanic:     "Compendium.ketsushin-salt-silver.items.Item.mechanic",
    locksmith:    "Compendium.ketsushin-salt-silver.items.Item.locksmith"
  };

  // -------------------------------------------------------------------------
  // Sprachen (Languages)
  // Flache Struktur – keine Dialekte oder Exotensprachen-Kategorien.
  // -------------------------------------------------------------------------
  CONFIG.DND5E.languages = {
    eng: { label: "Englisch" },
    deu: { label: "Deutsch" },
    esp: { label: "Spanisch" },
    ind: { label: "Indisch" },
    jpn: { label: "Japanisch" },
    zho: { label: "Chinesisch" },
    rus: { label: "Russisch" },
    fra: { label: "Französisch" },
    ara: { label: "Arabisch" },
    por: { label: "Portugiesisch" },
    ita: { label: "Italienisch" },
    lat: { label: "Latein" }
  };

  // -------------------------------------------------------------------------
  // Rüstungsklassen (Armor Classes / Armor Types)
  // Alle Fantasy-Rüstungen entfernt. Nur realistische Kategorien.
  // -------------------------------------------------------------------------
  CONFIG.DND5E.armorClasses = {
    clothing: { label: "Normale Kleidung", formula: "10 + @abilities.dex.mod" },
    light:    { label: "Leichte Rüstung",  formula: "11 + @abilities.dex.mod" },
    heavy:    { label: "Schwere Rüstung",  formula: "16" },
    shield:   { label: "Schild",           formula: "@attributes.ac.base + 2" }
  };

  CONFIG.DND5E.armorTypes = {
    clothing: "Normale Kleidung",
    light:    "Leichte Rüstung",
    heavy:    "Schwere Rüstung",
    shield:   "Schild"
  };

  // -------------------------------------------------------------------------
  // Waffenfertigkeiten & Waffentypen (Weapon Proficiencies / Weapon Types)
  // Aufgeteilt in Leichte und Schwere Waffen.
  // -------------------------------------------------------------------------
  CONFIG.DND5E.weaponProficiencies = {
    sim: "Leichte Waffen",
    mar: "Schwere Waffen"
  };

  CONFIG.DND5E.weaponTypes = {
    simpleM:   "Leichte Nahkampfwaffe",
    simpleR:   "Leichte Fernkampfwaffe",
    martialM:  "Schwere Nahkampfwaffe",
    martialR:  "Schwere Fernkampfwaffe"
  };

  // Leichte Waffen (Simple)
  CONFIG.DND5E.simpleWeapons = {
    keule:          { label: "Keule",             type: "simpleM" },
    dolch:          { label: "Dolch",             type: "simpleM" },
    messer:         { label: "Messer",            type: "simpleM" },
    handaxt:        { label: "Handaxt",           type: "simpleM" },
    machete:        { label: "Machete",           type: "simpleM" },
    stab:           { label: "Stab",              type: "simpleM" },
    sichel:         { label: "Sichel",            type: "simpleM" },
    streitkolben:   { label: "Streitkolben",      type: "simpleM" },
    leichtArmbrust: { label: "Leichte Armbrust",  type: "simpleR" },
    leichtHammer:   { label: "Leichter Hammer",   type: "simpleR" },
    kurzbogen:      { label: "Kurzbogen",         type: "simpleR" },
    leichtPistole:  { label: "Leichte Pistole",   type: "simpleR" },
    schleuder:      { label: "Schleuder",         type: "simpleR" }
  };

  // Schwere Waffen (Martial)
  CONFIG.DND5E.martialWeapons = {
    kampfaxt:      { label: "Kampfaxt",          type: "martialM" },
    schwert:       { label: "Schwert",           type: "martialM" },
    hammer:        { label: "Hammer",            type: "martialM" },
    peitsche:      { label: "Peitsche",          type: "martialM" },
    rapier:        { label: "Rapier",            type: "martialM" },
    saebel:        { label: "Säbel",             type: "martialM" },
    flegel:        { label: "Flegel",            type: "martialM" },
    schwerPistole: { label: "Schwere Pistole",   type: "martialR" },
    gewehr:        { label: "Gewehr",            type: "martialR" },
    schwerArmbrust:{ label: "Schwere Armbrust",  type: "martialR" },
    langbogen:     { label: "Langbogen",         type: "martialR" }
  };

  // -------------------------------------------------------------------------
  // Schadensarten (Damage Types)
  // -------------------------------------------------------------------------
  CONFIG.DND5E.damageTypes = {
    slashing:   { label: "Hieb",              icon: "icons/svg/sword.svg" },
    piercing:   { label: "Stich",             icon: "icons/svg/dagger.svg" },
    bludgeoning:{ label: "Wucht",             icon: "icons/svg/mace.svg" },
    lightning:  { label: "Blitz/Strom/Energie", icon: "icons/svg/lightning.svg" },
    fire:       { label: "Feuer",             icon: "icons/svg/fire.svg" },
    cold:       { label: "Kälte",             icon: "icons/svg/ice-storm.svg" },
    acid:       { label: "Säure",             icon: "icons/svg/acid.svg" },
    poison:     { label: "Gift",              icon: "icons/svg/poison.svg" },
    thunder:    { label: "Schall",            icon: "icons/svg/thunder.svg" },
    radiant:    { label: "Gleißend",          icon: "icons/svg/sun.svg" },
    holy:       { label: "Geheiligt",         icon: "icons/svg/holy.svg" },
    necrotic:   { label: "Nekrotisch",        icon: "icons/svg/skull.svg" },
    psychic:    { label: "Psychisch",         icon: "icons/svg/psychic.svg" }
  };

  // -------------------------------------------------------------------------
  // Waffeneigenschaften (Weapon Properties)
  // Nur 'Magisch/Geheiligt' und 'Versilbert' behalten.
  // -------------------------------------------------------------------------
  CONFIG.DND5E.weaponProperties = {
    mgc: { label: "Magisch/Geheiligt", abbreviation: "Mag" },
    sil: { label: "Versilbert",        abbreviation: "Sil" }
  };

  // -------------------------------------------------------------------------
  // Währungen (Currencies)
  // Alle DnD-Standardwährungen (gp, sp, cp …) werden ersetzt.
  // -------------------------------------------------------------------------
  CONFIG.DND5E.currencies = {
    eur: { label: "Euro",              abbreviation: "€",  conversion: 1     },
    usd: { label: "US-Dollar",         abbreviation: "$",  conversion: 1     },
    jpy: { label: "Japanischer Yen",   abbreviation: "¥",  conversion: 0.006 },
    cny: { label: "Chinesischer Yuan", abbreviation: "¥",  conversion: 0.13  },
    rub: { label: "Russischer Rubel",  abbreviation: "₽",  conversion: 0.011 }
  };

  console.log("Ketsushin: Salt & Silver | CONFIG.DND5E erfolgreich überschrieben.");
});

// =============================================================================
// UI-Anpassung: Charakterbogen – Zauber → Rituale & Zeichen
// Wird jedes Mal ausgeführt, wenn ein Charakterbogen gerendert wird.
// =============================================================================
Hooks.on("renderActorSheet5eCharacter", function (sheet, html, _data) {

  // ---------------------------------------------------------------------------
  // 1. Tab-Bezeichnung 'Spellbook' → 'Rituale & Zeichen' umbenennen
  //    Selektoren decken dnd5e 3.x (data-tab) und ältere Versionen (i18n-Span) ab.
  // ---------------------------------------------------------------------------
  html.find(".tabs .item[data-tab='spellbook']").each(function () {
    // Das sichtbare Text-Label aktualisieren, Icon/Tooltip unangetastet lassen
    const $tab = $(this);
    $tab.find(".tab-label, span:not(.fas):not(.far)").first().text("Rituale & Zeichen");
    // Fallback: wenn kein Kindelement das Label hält, direkt den eigenen Textknoten ersetzen
    if ($tab.find(".tab-label, span:not(.fas):not(.far)").length === 0) {
      $tab.contents().filter(function () {
        return this.nodeType === Node.TEXT_NODE && this.textContent.trim() !== "";
      }).first().replaceWith(document.createTextNode("Rituale & Zeichen"));
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Alle Zauberslots und Spell-Level-Header (Level 1–9) ausblenden.
  //    Ausschließlich Cantrips (Level 0) bleiben sichtbar.
  //
  //    dnd5e 3.x verwendet data-level auf .items-section und .spellbook-header.
  //    Zusätzlich wird die Slot-Leiste (.spell-slots) komplett versteckt.
  // ---------------------------------------------------------------------------

  // Spell-Level-Sektionen 1–9 ausblenden (data-level="1" … data-level="9")
  for (let level = 1; level <= 9; level++) {
    html.find(`[data-level="${level}"]`).hide();
    // Ältere dnd5e-Versionen nutzen .spell-level-N Klassen
    html.find(`.spell-level-${level}`).hide();
  }

  // Alle Slot-Ressourcen-Bereiche ausblenden (Pip-Leisten, Slot-Counter)
  html.find(".spell-slots, .spell-slot-uses, .spell-pips").hide();

  // Spellbook-Header die explizit ein Level > 0 referenzieren ausblenden
  // (Header-Zeilen tragen oft data-level oder eine aria-/class-Referenz)
  html.find(".spellbook-header:not([data-level='0'])").hide();
  html.find(".items-header[data-level]:not([data-level='0'])").hide();

  // Sicherheitsnetz: jede Sektion ausblenden, die kein Cantrip-Inhalt ist
  // und deren Überschrift eine Zahl ≥ 1 enthält (localized labels wie "1. Grad")
  html.find(".spellbook-list .spell-level-label, .spell-header .spell-level-label")
    .filter(function () {
      return /[1-9]/.test($(this).text());
    })
    .closest(".items-section, .spellbook-section, .spell-level-section")
    .hide();

  // ---------------------------------------------------------------------------
  // 3. Währungs-UI: native Sektion ersetzen durch Geldbörse / Bank
  // ---------------------------------------------------------------------------
  const MODULE_ID  = "ketsushin-salt-silver";
  const CURRENCIES = ["eur", "usd", "jpy", "cny", "rub"];
  const CUR_LABELS = { eur: "€ EUR", usd: "$ USD", jpy: "¥ JPY", cny: "¥ CNY", rub: "₽ RUB" };
  const EMPTY_PURSE = () => ({ eur: 0, usd: 0, jpy: 0, cny: 0, rub: 0 });

  const actor = sheet.actor;

  // Flag-Struktur beim ersten Öffnen anlegen (non-blocking)
  (async () => {
    if (!actor.getFlag(MODULE_ID, "wallet")) await actor.setFlag(MODULE_ID, "wallet", EMPTY_PURSE());
    if (!actor.getFlag(MODULE_ID, "bank"))   await actor.setFlag(MODULE_ID, "bank",   EMPTY_PURSE());
  })();

  // Native Währungssektion ausblenden
  html.find(".currency, .currencies, .currency-list, [class*='currency']").hide();

  // Aktuellen Anzeigemodus ermitteln (Standard: wallet)
  let mode = "wallet";

  /** Baut die fünf Eingabefelder für den angegebenen Modus. */
  function buildInputs(currentMode) {
    const data = actor.getFlag(MODULE_ID, currentMode) ?? EMPTY_PURSE();
    return CURRENCIES.map(cur => `
      <div class="ks-currency-field">
        <label class="ks-currency-label">${CUR_LABELS[cur]}</label>
        <input class="ks-currency-input" type="number" min="0" step="1"
               data-currency="${cur}" value="${data[cur] ?? 0}">
      </div>`).join("");
  }

  // Widget aufbauen
  const $widget = $(`
    <div class="ks-currency-wrapper">
      <div class="ks-toggle-bar">
        <span class="ks-account-label active">Geldbörse</span>
        <button type="button" class="ks-toggle-btn" title="Konto wechseln">&#8644;</button>
        <span class="ks-account-label">Bank</span>
        <button type="button" class="ks-exchange-btn" title="Geld wechseln">Geld wechseln</button>
      </div>
      <div class="ks-currency-inputs">${buildInputs(mode)}</div>
    </div>`);

  // Widget einsetzen: nach nativer Währungssektion oder ans Sheet-Ende
  const $anchor = html.find(".currency, .currencies, .currency-list").first();
  if ($anchor.length) {
    $anchor.after($widget);
  } else {
    html.find(".sheet-body, form").first().append($widget);
  }

  /** Bindet Change-Events der aktuell sichtbaren Inputs. */
  function bindInputs() {
    $widget.find(".ks-currency-input").on("change", async function () {
      const cur = $(this).data("currency");
      const val = Math.max(0, parseInt($(this).val(), 10) || 0);
      $(this).val(val); // negativen Input abfangen
      const existing = foundry.utils.deepClone(actor.getFlag(MODULE_ID, mode) ?? EMPTY_PURSE());
      existing[cur] = val;
      await actor.setFlag(MODULE_ID, mode, existing);
    });
  }
  bindInputs();

  // Toggle-Button: Geldbörse ↔ Bank
  $widget.on("click", ".ks-toggle-btn", function () {
    mode = mode === "wallet" ? "bank" : "wallet";
    const $labels = $widget.find(".ks-account-label");
    $labels.eq(0).toggleClass("active", mode === "wallet");
    $labels.eq(1).toggleClass("active", mode === "bank");
    $widget.find(".ks-currency-inputs").html(buildInputs(mode));
    bindInputs(); // Events nach HTML-Ersatz neu binden
  });

  // Geld-wechseln-Button: Öffnet den Umtausch-Dialog
  $widget.on("click", ".ks-exchange-btn", function () {
    new KetsushinExchangeDialog(actor, mode, () => {
      // Inputs nach erfolgreichem Tausch neu laden
      $widget.find(".ks-currency-inputs").html(buildInputs(mode));
      bindInputs();
    }).render(true);
  });
});
