// Ketsushin: Salt & Silver

// Werkzeug-Definitionen: Kategorie → { label, items: { key: deutscherName } }
const KS_TOOLS = {
  art: {
    label: "Handwerkszeug",
    items: {
      alchemist:    "Alchemie",
      brewer:       "Brauerei",
      calligrapher: "Kalligrafie",
      tinker:       "Bastler",
      cartographer: "Kartografie",
      cook:         "Koch",
      mason:        "Steinmetz",
      jeweler:      "Juwelier",
      glassblower:  "Glasbläser",
      leatherwork:  "Lederbearbeitung",
      cobbler:      "Schuster",
      painter:      "Maler",
      potter:       "Töpfer",
      smith:        "Schmiede",
      carpenter:    "Tischler",
      weaver:       "Weber",
      woodcarver:   "Schnitz",
      mechanic:     "Mechaniker",
      locksmith:    "Schlosser"
    }
  },
  music: {
    label: "Instrumente",
    items: {
      bagpipe:   "Dudelsack",
      drum:      "Trommel",
      dulcimer:  "Hackbrett",
      flute:     "Flöte",
      horn:      "Horn",
      lute:      "Laute",
      lyre:      "Leier",
      panflute:  "Panflöte",
      shawm:     "Schalmei",
      viol:      "Gambe",
      klavier:   "Klavier",
      saxophon:  "Saxophon",
      trompete:  "Trompete",
      triangel:  "Triangel",
      geige:     "Geige"
    }
  },
  game: {
    label: "Spielsets",
    items: {
      dice:               "Würfelset",
      threedragons:       "Three-Dragon Ante",
      poker:              "Poker",
      blackjack:          "Blackjack",
      schach:             "Schach",
      dame:               "Dame",
      mahjong:            "Mahjong",
      go:                 "Go",
      russischesRoulette: "Russisches Roulette",
      shogi:              "Shogi",
      uno:                "Uno",
      monopoly:           "Monopoly"
    }
  },
  vehicle: {
    label: "Fahrzeuge",
    items: {
      air:   "Luftfahrzeug",
      land:  "Landfahrzeug",
      water: "Wasserfahrzeug",
      space: "Raumfahrzeug"
    }
  }
};

// Umrechnungskurse: Einheiten pro 1 EUR
const KS_EXCHANGE_RATES = {
  eur: 1,
  usd: 1.0,
  cny: 10.0,
  jpy: 100.0,
  rub: 100.0
};


function ksConvertCurrency(amount, from, to) {
  if (from === to) return amount;
  const amountInEur = amount / KS_EXCHANGE_RATES[from];
  return Math.floor(amountInEur * KS_EXCHANGE_RATES[to]);
}

class KetsushinExchangeDialog extends Dialog {
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

Hooks.once("init", function () {

  // Fertigkeiten
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

  // Werkzeuge – Platzhalter-UUIDs, nach Kompendium-Erstellung anpassen
  CONFIG.DND5E.toolIds = {

    // Handwerkszeug (Artisan's Tools)
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
    locksmith:    "Compendium.ketsushin-salt-silver.items.Item.locksmith",

    // Fahrzeuge – kein Raumfahrzeug
    airVehicle:   "Compendium.ketsushin-salt-silver.items.Item.airVehicle",
    landVehicle:  "Compendium.ketsushin-salt-silver.items.Item.landVehicle",
    waterVehicle: "Compendium.ketsushin-salt-silver.items.Item.waterVehicle",

    // Instrumente
    bagpipe:    "Compendium.ketsushin-salt-silver.items.Item.bagpipe",
    drum:       "Compendium.ketsushin-salt-silver.items.Item.drum",
    dulcimer:   "Compendium.ketsushin-salt-silver.items.Item.dulcimer",
    flute:      "Compendium.ketsushin-salt-silver.items.Item.flute",
    horn:       "Compendium.ketsushin-salt-silver.items.Item.horn",
    lute:       "Compendium.ketsushin-salt-silver.items.Item.lute",
    lyre:       "Compendium.ketsushin-salt-silver.items.Item.lyre",
    panflute:   "Compendium.ketsushin-salt-silver.items.Item.panflute",
    shawm:      "Compendium.ketsushin-salt-silver.items.Item.shawm",
    viol:       "Compendium.ketsushin-salt-silver.items.Item.viol",
    klavier:    "Compendium.ketsushin-salt-silver.items.Item.klavier",
    saxophon:   "Compendium.ketsushin-salt-silver.items.Item.saxophon",
    trompete:   "Compendium.ketsushin-salt-silver.items.Item.trompete",
    triangel:   "Compendium.ketsushin-salt-silver.items.Item.triangel",
    geige:      "Compendium.ketsushin-salt-silver.items.Item.geige",

    // Spielsets – ohne Dragonchess & Playing Cards
    dice:               "Compendium.ketsushin-salt-silver.items.Item.dice",
    threedragons:       "Compendium.ketsushin-salt-silver.items.Item.threedragons",
    poker:              "Compendium.ketsushin-salt-silver.items.Item.poker",
    blackjack:          "Compendium.ketsushin-salt-silver.items.Item.blackjack",
    schach:             "Compendium.ketsushin-salt-silver.items.Item.schach",
    dame:               "Compendium.ketsushin-salt-silver.items.Item.dame",
    mahjong:            "Compendium.ketsushin-salt-silver.items.Item.mahjong",
    go:                 "Compendium.ketsushin-salt-silver.items.Item.go",
    russischesRoulette: "Compendium.ketsushin-salt-silver.items.Item.russischesRoulette",
    shogi:              "Compendium.ketsushin-salt-silver.items.Item.shogi",
    uno:                "Compendium.ketsushin-salt-silver.items.Item.uno",
    monopoly:           "Compendium.ketsushin-salt-silver.items.Item.monopoly"
  };

  // Sprachen
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

  // Rüstungen
  CONFIG.DND5E.armorClasses = {
    clothing: { label: "Normale Kleidung", formula: "10 + @abilities.dex.mod" },
    light:    { label: "Leichte Rüstung",  formula: "11 + @abilities.dex.mod" },
    heavy:    { label: "Schwere Rüstung",  formula: "16" },
    shield:   { label: "Schild",           formula: "@attributes.ac.base + 2" }
  };

  // lgt/hvy/shl = dnd5e's tatsächliche Proficiency-Keys für Rüstungen
  CONFIG.DND5E.armorTypes = {
    lgt: "Leichte Rüstung",
    hvy: "Mittlere/Schwere Rüstung",
    shl: "Schilde"
  };

  // Waffen
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

  CONFIG.DND5E.simpleWeapons = {
    keule:          { label: "Keule",             type: "simpleM" },
    dolch:          { label: "Dolch",             type: "simpleM" },
    messer:         { label: "Messer",            type: "simpleM" },
    handaxt:        { label: "Handaxt",           type: "simpleM" },
    machete:        { label: "Machete",           type: "simpleM" },
    stab:           { label: "Stab",              type: "simpleM" },
    sichel:         { label: "Sichel",            type: "simpleM" },
    leichtArmbrust: { label: "Leichte Armbrust",  type: "simpleR" },
    leichtHammer:   { label: "Leichter Hammer",   type: "simpleR" },
    kurzbogen:      { label: "Kurzbogen",         type: "simpleR" },
    leichtPistole:  { label: "Leichte Pistole",   type: "simpleR" },
    schleuder:      { label: "Schleuder",         type: "simpleR" }
  };

  CONFIG.DND5E.martialWeapons = {
    schwert:       { label: "Schwert",           type: "martialM" },
    hammer:        { label: "Hämmer",            type: "martialM" },
    peitsche:      { label: "Peitsche",          type: "martialM" },
    rapier:        { label: "Rapier",            type: "martialM" },
    saebel:        { label: "Säbel",             type: "martialM" },
    flegel:        { label: "Flegel",            type: "martialM" },
    schwerPistole: { label: "Schwere Pistole",   type: "martialR" },
    gewehr:        { label: "Gewehre",           type: "martialR" },
    schwerArmbrust:{ label: "Schwere Armbrust",  type: "martialR" },
    langbogen:     { label: "Langbogen",         type: "martialR" },
    flammenwerfer: { label: "Flammenwerfer",      type: "martialR" }
  };

  // Schadensarten
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

  // Waffeneigenschaften
  CONFIG.DND5E.weaponProperties = {
    mgc: { label: "Magisch/Geheiligt", abbreviation: "Mag" },
    sil: { label: "Versilbert",        abbreviation: "Sil" }
  };

  // Werkzeugkategorien (für Proficiency-Picker-Gruppenüberschriften)
  CONFIG.DND5E.toolTypes = {
    art:     "Handwerkszeug",
    music:   "Instrumente",
    game:    "Spielsets",
    vehicle: "Fahrzeuge"
  };

  // Währungen
  CONFIG.DND5E.currencies = {
    eur: { label: "Euro",              abbreviation: "€",  conversion: 1     },
    usd: { label: "US-Dollar",         abbreviation: "$",  conversion: 1     },
    jpy: { label: "Japanischer Yen",   abbreviation: "¥",  conversion: 0.006 },
    cny: { label: "Chinesischer Yuan", abbreviation: "¥",  conversion: 0.13  },
    rub: { label: "Russischer Rubel",  abbreviation: "₽",  conversion: 0.011 }
  };

  // ==========================================================================
  // CONFIG.DND5E.traits[trait].choices setzen
  // Wenn dieses Feld gesetzt ist, ignoriert dnd5e 3.x/4.x den Compendium-Lookup
  // (Trait.getBaseItems) vollständig und nutzt stattdessen direkt unsere Daten.
  // Muss am Ende des init-Hooks stehen, damit simpleWeapons/martialWeapons
  // bereits gesetzt sind.
  // ==========================================================================

  // Werkzeuge
  if (CONFIG.DND5E.traits?.tool) {
    const toolChoices = {};
    for (const [catKey, cat] of Object.entries(KS_TOOLS))
      toolChoices[catKey] = {
        label:    cat.label,
        children: Object.fromEntries(Object.entries(cat.items).map(([k, v]) => [k, { label: v }]))
      };
    CONFIG.DND5E.traits.tool.choices = toolChoices;
  }

  // Waffen
  if (CONFIG.DND5E.traits?.weapon) {
    CONFIG.DND5E.traits.weapon.choices = {
      sim: {
        label:    "Leichte Waffen",
        children: Object.fromEntries(
          Object.entries(CONFIG.DND5E.simpleWeapons).map(([k, v]) => [k, { label: v.label }])
        )
      },
      mar: {
        label:    "Schwere Waffen",
        children: Object.fromEntries(
          Object.entries(CONFIG.DND5E.martialWeapons).map(([k, v]) => [k, { label: v.label }])
        )
      }
    };
  }

  // Rüstungen
  if (CONFIG.DND5E.traits?.armor) {
    CONFIG.DND5E.traits.armor.choices = Object.fromEntries(
      Object.entries(CONFIG.DND5E.armorTypes).map(([k, v]) => [k, { label: typeof v === "string" ? v : (v.label ?? k) }])
    );
  }

  console.log("Ketsushin: Salt & Silver | CONFIG.DND5E + traits.choices erfolgreich überschrieben.");
});

Hooks.on("renderActorSheet5eCharacter", function (sheet, html, _data) {

  // Tab "Spellbook" → "Rituale & Zeichen"
  html.find(".tabs .item[data-tab='spellbook']").each(function () {
    const $tab = $(this);
    $tab.find(".tab-label, span:not(.fas):not(.far)").first().text("Rituale & Zeichen");
    if ($tab.find(".tab-label, span:not(.fas):not(.far)").length === 0) {
      $tab.contents().filter(function () {
        return this.nodeType === Node.TEXT_NODE && this.textContent.trim() !== "";
      }).first().replaceWith(document.createTextNode("Rituale & Zeichen"));
    }
  });

  // Zauberslots Level 1–9 ausblenden, Cantrips bleiben sichtbar
  for (let level = 1; level <= 9; level++) {
    html.find(`[data-level="${level}"]`).hide();
    html.find(`.spell-level-${level}`).hide();
  }

  html.find(".spell-slots, .spell-slot-uses, .spell-pips").hide();
  html.find(".spellbook-header:not([data-level='0'])").hide();
  html.find(".items-header[data-level]:not([data-level='0'])").hide();

  // Fallback: Sektionen mit Grad-Zahl im Label
  html.find(".spellbook-list .spell-level-label, .spell-header .spell-level-label")
    .filter(function () {
      return /[1-9]/.test($(this).text());
    })
    .closest(".items-section, .spellbook-section, .spell-level-section")
    .hide();

  // Geldbörse / Bank
  const MODULE_ID  = "ketsushin-salt-silver";
  const CURRENCIES = ["eur", "usd", "jpy", "cny", "rub"];
  const CUR_LABELS = { eur: "€ EUR", usd: "$ USD", jpy: "¥ JPY", cny: "¥ CNY", rub: "₽ RUB" };
  const EMPTY_PURSE = () => ({ eur: 0, usd: 0, jpy: 0, cny: 0, rub: 0 });

  const actor = sheet.actor;

  (async () => {
    if (!actor.getFlag(MODULE_ID, "wallet")) await actor.setFlag(MODULE_ID, "wallet", EMPTY_PURSE());
    if (!actor.getFlag(MODULE_ID, "bank"))   await actor.setFlag(MODULE_ID, "bank",   EMPTY_PURSE());
  })();

  html.find(".currency, .currencies, .currency-list, [class*='currency']").hide();

  let mode = "wallet";

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

  const $anchor = html.find(".currency, .currencies, .currency-list").first();
  if ($anchor.length) {
    $anchor.after($widget);
  } else {
    html.find(".sheet-body, form").first().append($widget);
  }

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

// =============================================================================
// Proficiency-Picker: deutsche Bezeichnungen für Waffen, Rüstungen & Werkzeuge
//
// Strategie A – fromUuid/fromUuidSync: synthetische Items für unsere UUIDs.
// Strategie B – Trait.choices: direkter Patch auf dnd5e.documents.Trait.
// Strategie C – dnd5e.buildTraitChoices: offizieller dnd5e-Modul-Hook (3.x).
// Strategie D – DOM-Patch: greift für AppV1 UND AppV2 (Foundry V12).
// =============================================================================
Hooks.once("ready", function () {
  const MODULE_ID = "ketsushin-salt-silver";

  // Kategorie-Keys aus KS_TOOLS
  const KS_CAT_KEYS = new Set(Object.keys(KS_TOOLS));

  // Flache Key → Label Tabellen
  const KS_TOOL_FLAT = {};
  for (const cat of Object.values(KS_TOOLS))
    for (const [k, v] of Object.entries(cat.items))
      KS_TOOL_FLAT[k] = v;
  const KS_TOOL_KEYS = new Set(Object.keys(KS_TOOL_FLAT));

  const KS_WEAPON_FLAT = {};
  for (const [k, v] of Object.entries(CONFIG.DND5E.simpleWeapons  ?? {})) KS_WEAPON_FLAT[k] = v.label;
  for (const [k, v] of Object.entries(CONFIG.DND5E.martialWeapons ?? {})) KS_WEAPON_FLAT[k] = v.label;

  const KS_ARMOR_FLAT = {};
  for (const [k, v] of Object.entries(CONFIG.DND5E.armorTypes ?? {}))
    KS_ARMOR_FLAT[k] = typeof v === "string" ? v : (v.label ?? k);

  // ── Strategie A: fromUuid / fromUuidSync ────────────────────────────────
  const KS_SYNTH = {};
  for (const [catKey, cat] of Object.entries(KS_TOOLS)) {
    for (const [toolKey, toolName] of Object.entries(cat.items)) {
      const uuid = `Compendium.${MODULE_ID}.items.Item.${toolKey}`;
      KS_SYNTH[uuid] = {
        id: toolKey, uuid, documentName: "Item",
        pack: `${MODULE_ID}.items`, name: toolName, type: "tool",
        system: { type: { value: catKey, subtype: "" }, proficient: null, bonus: "" },
        toObject() { return foundry.utils.deepClone(this); },
        toJSON()   { return foundry.utils.deepClone(this); }
      };
    }
  }
  const _fromUuid = globalThis.fromUuid;
  if (typeof _fromUuid === "function")
    globalThis.fromUuid = async (uuid, opts) => KS_SYNTH[uuid] ?? _fromUuid(uuid, opts);
  const _fromUuidSync = globalThis.fromUuidSync;
  if (typeof _fromUuidSync === "function")
    globalThis.fromUuidSync = (uuid, opts) => KS_SYNTH[uuid] ?? _fromUuidSync(uuid, opts);

  // ── Strategie B: Trait.choices patch ───────────────────────────────────
  const Trait = globalThis.dnd5e?.documents?.Trait;
  if (Trait?.choices) {
    const _choices = Trait.choices;
    Trait.choices = async function (trait, opts = {}) {
      if (trait === "tool") {
        const r = {};
        for (const [ck, cat] of Object.entries(KS_TOOLS))
          r[ck] = { label: cat.label, children: Object.fromEntries(Object.entries(cat.items).map(([k, v]) => [k, { label: v }])) };
        return r;
      }
      if (trait === "weapon") {
        const sim = {}, mar = {};
        for (const [k, v] of Object.entries(CONFIG.DND5E.simpleWeapons  ?? {})) sim[k] = { label: v.label };
        for (const [k, v] of Object.entries(CONFIG.DND5E.martialWeapons ?? {})) mar[k] = { label: v.label };
        return { sim: { label: "Leichte Waffen", children: sim }, mar: { label: "Schwere Waffen", children: mar } };
      }
      if (trait === "armor") {
        return Object.fromEntries(Object.entries(KS_ARMOR_FLAT).map(([k, v]) => [k, { label: v }]));
      }
      return _choices.call(this, trait, opts);
    };
  }

  // ── Strategie C: dnd5e.buildTraitChoices (offizieller dnd5e 3.x API-Hook)
  // Signatur je nach Version: (choices, {trait,...}) oder (trait, choices)
  Hooks.on("dnd5e.buildTraitChoices", function (a, b) {
    // Argument-Reihenfolge flexibel behandeln
    const trait   = typeof a === "string" ? a : (b?.trait ?? a?.trait ?? "");
    const choices = typeof a === "object"  ? a : b;
    if (!choices || typeof choices !== "object") return;

    if (trait === "tool") {
      for (const key of Object.keys(choices)) delete choices[key];
      for (const [catKey, cat] of Object.entries(KS_TOOLS))
        choices[catKey] = {
          label:    cat.label,
          children: Object.fromEntries(Object.entries(cat.items).map(([k, v]) => [k, { label: v }]))
        };
    }
    else if (trait === "weapon") {
      for (const key of Object.keys(choices)) delete choices[key];
      const sim = {}, mar = {};
      for (const [k, v] of Object.entries(CONFIG.DND5E.simpleWeapons  ?? {})) sim[k] = { label: v.label };
      for (const [k, v] of Object.entries(CONFIG.DND5E.martialWeapons ?? {})) mar[k] = { label: v.label };
      choices.sim = { label: "Leichte Waffen", children: sim };
      choices.mar = { label: "Schwere Waffen", children: mar };
    }
    else if (trait === "armor") {
      for (const key of Object.keys(choices)) delete choices[key];
      for (const [k, v] of Object.entries(KS_ARMOR_FLAT)) choices[k] = { label: v };
    }
  });

  // ── Strategie E: Trait.getBaseItems + ProficiencyConfig._prepareContext ──
  // (Greift wenn Strategie B/C scheitert – neue direkte Eingriffe)

  // E1: getBaseItems – liefert unsere synthetischen Items statt Compendium
  if (Trait?.getBaseItems) {
    const _gbi = Trait.getBaseItems;
    Trait.getBaseItems = async function (trait, opts) {
      if (trait === "tool") {
        const items = [];
        for (const [catKey, cat] of Object.entries(KS_TOOLS))
          for (const [key, name] of Object.entries(cat.items))
            items.push({ identifier: key, name, type: "tool",
                         system: { type: { value: catKey } } });
        return items;
      }
      if (trait === "sim" || trait === "weapon") {
        const items = Object.entries(CONFIG.DND5E.simpleWeapons ?? {}).map(([k, v]) =>
          ({ identifier: k, name: v.label, type: "weapon", system: { type: { value: "sim" } } }));
        if (trait === "weapon") items.push(...Object.entries(CONFIG.DND5E.martialWeapons ?? {}).map(([k, v]) =>
          ({ identifier: k, name: v.label, type: "weapon", system: { type: { value: "mar" } } })));
        return items;
      }
      if (trait === "mar") {
        return Object.entries(CONFIG.DND5E.martialWeapons ?? {}).map(([k, v]) =>
          ({ identifier: k, name: v.label, type: "weapon", system: { type: { value: "mar" } } }));
      }
      return _gbi.call(this, trait, opts);
    };
    console.log("KS | Trait.getBaseItems gepatcht ✓");
  }

  // E2: ProficiencyConfig._prepareContext – ersetzt ctx.choices komplett
  const PC = globalThis.dnd5e?.applications?.actor?.ProficiencyConfig
    || globalThis.dnd5e?.applications?.ProficiencyConfig
    || (() => {
         for (const ns of Object.values(globalThis.dnd5e?.applications ?? {})) {
           if (typeof ns === "object" && ns !== null) {
             for (const v of Object.values(ns)) {
               if (typeof v === "function" && v.name === "ProficiencyConfig") return v;
             }
           }
           if (typeof ns === "function" && ns.name === "ProficiencyConfig") return ns;
         }
         return null;
       })();
  function _buildKsChoices(trait) {
    if (trait === "tool") {
      const c = {};
      for (const [ck, cat] of Object.entries(KS_TOOLS))
        c[ck] = { label: cat.label,
                  children: Object.fromEntries(Object.entries(cat.items).map(([k,v]) => [k, {label:v}])) };
      return c;
    }
    if (trait === "weapon") {
      const sim = {}, mar = {};
      for (const [k,v] of Object.entries(CONFIG.DND5E.simpleWeapons  ?? {})) sim[k] = {label: v.label};
      for (const [k,v] of Object.entries(CONFIG.DND5E.martialWeapons ?? {})) mar[k] = {label: v.label};
      return { sim: { label: "Leichte Waffen", children: sim },
               mar: { label: "Schwere Waffen",  children: mar } };
    }
    if (trait === "sim") {
      return { sim: { label: "Leichte Waffen",
        children: Object.fromEntries(Object.entries(CONFIG.DND5E.simpleWeapons  ?? {}).map(([k,v]) => [k, {label:v.label}])) } };
    }
    if (trait === "mar") {
      return { mar: { label: "Schwere Waffen",
        children: Object.fromEntries(Object.entries(CONFIG.DND5E.martialWeapons ?? {}).map(([k,v]) => [k, {label:v.label}])) } };
    }
    if (trait === "armor") {
      return Object.fromEntries(
        Object.entries(CONFIG.DND5E.armorTypes ?? {}).map(([k,v]) => [k, {label: typeof v === "string" ? v : (v.label ?? k)}])
      );
    }
    return null;
  }
  if (PC) {
    for (const methodName of ["_prepareContext", "getData"]) {
      if (PC.prototype[methodName]) {
        const _orig = PC.prototype[methodName];
        PC.prototype[methodName] = async function (options) {
          const ctx = await _orig.call(this, options);
          const trait = this.trait ?? this.attribute
            ?? this.options?.trait ?? this.options?.attribute ?? "";
          const ks = _buildKsChoices(trait);
          if (ks) ctx.choices = ks;
          return ctx;
        };
        console.log(`KS | ProficiencyConfig.${methodName} gepatcht ✓`);
        break;
      }
    }
  } else {
    console.warn("KS | ProficiencyConfig nicht gefunden – nur DOM-Patch aktiv");
  }

  // ── Strategie F: DOM-Injection – fügt fehlende Items in die Liste ein ──
  // Greift wenn die data-Ebene nicht überschrieben werden konnte.
  function _injectMissingArmorItems($h) {
    // Shield-Element finden — entweder via data-key oder dnd5e-checkbox
    let $shieldLi = $h.find("[data-key='shield'], [data-key='armor:shield']").filter("li").first();
    let $container = $shieldLi.length ? $shieldLi.parent() : null;
    let usesCb = false; // true = dnd5e-checkbox-Ansatz, false = native input
    let baseName = "";
    let shieldDataKey = "";

    if ($shieldLi.length) {
      shieldDataKey = $shieldLi.attr("data-key") ?? "";
      // native <input>: Name rauslesen um Basisname zu ermitteln
      const shieldInput = $shieldLi.find("input").first();
      const shieldCb = $shieldLi.find("dnd5e-checkbox").first();
      if (shieldCb.length) {
        usesCb = true;
        const n = shieldCb.attr("name") ?? "";
        baseName = n.slice(0, n.lastIndexOf("."));
      } else if (shieldInput.length) {
        const n = shieldInput.attr("name") ?? "";
        // Format A: "...armorProf.value.shield" → baseName = "...armorProf.value"
        if (n.endsWith(".shield")) {
          baseName = n.slice(0, n.lastIndexOf("."));
        } else {
          // Format B: "...armorProf.value" (value-Attribut = "shield")
          baseName = n;
        }
      }
    } else {
      // Fallback: dnd5e-checkbox-Ansatz
      const $cb = $h.find("dnd5e-checkbox[name$='.armorProf.value.shield']").first();
      if ($cb.length) {
        usesCb = true;
        $shieldLi = $cb.closest("li");
        $container = $cb.closest("ol.trait-list");
        const n = $cb.attr("name") ?? "";
        baseName = n.slice(0, n.lastIndexOf("."));
      }
    }
    if (!$shieldLi.length || !$container?.length || !baseName) return;

    // "light" und "heavy" als NEUE (frische) Elemente einfügen
    for (const [key, label] of [["heavy", "Mittlere/Schwere Rüstung"], ["light", "Leichte Rüstung"]]) {
      if ($container.find(`[data-key="${key}"], [data-key="armor:${key}"]`).length) continue;
      if ($container.find(`dnd5e-checkbox[name$=".armorProf.value.${key}"]`).length) continue;

      const li = document.createElement("li");
      if (shieldDataKey) li.setAttribute("data-key", shieldDataKey.replace("shield", key));

      if (usesCb) {
        // dnd5e-checkbox (wie WeaponsConfig)
        const lbl = document.createElement("label");
        lbl.className = "name";
        lbl.textContent = label;
        const cb = document.createElement("dnd5e-checkbox");
        cb.setAttribute("name", `${baseName}.${key}`);
        li.appendChild(lbl);
        li.appendChild(cb);
      } else {
        // native <input type="checkbox">
        const lbl = document.createElement("label");
        lbl.className = "name";
        lbl.textContent = label;
        const inp = document.createElement("input");
        inp.type = "checkbox";
        // Format A: flat key im Name
        if (!baseName.endsWith(".value") || baseName.endsWith(".value")) {
          // Sicherheitshalber beide Formate unterstützen:
          const shieldInputEl = $shieldLi.find("input").first()[0];
          if (shieldInputEl && (shieldInputEl.getAttribute("name") ?? "").endsWith(".shield")) {
            inp.setAttribute("name", `${baseName}.${key}`);
          } else {
            inp.setAttribute("name", baseName);
            inp.setAttribute("value", key);
          }
        }
        inp.checked = false;
        li.appendChild(lbl);
        li.appendChild(inp);
      }

      $container[0].insertBefore(li, $container[0].firstChild);
    }

    // Überschrift des Shield-Containers auf "Rüstungen" setzen
    $container[0].closest("fieldset, section")?.querySelector("legend, .category-label, .section-header")
      ?.replaceWith(Object.assign(document.createElement(
        $container[0].closest("fieldset") ? "legend" : "div"
      ), { textContent: "Rüstungen", className: "category-label" }));
  }

  function _injectMissingWeaponItems($h, profSet) {
    // WeaponsConfig (dnd5e 4.x): Kategorien via dnd5e-checkbox name="...weaponProf.value.sim/mar"
    const cats = {
      sim: { items: CONFIG.DND5E.simpleWeapons  ?? {} },
      mar: { items: CONFIG.DND5E.martialWeapons ?? {} }
    };
    for (const [catKey, cat] of Object.entries(cats)) {
      const $allCb = $h.find(`dnd5e-checkbox[name$=".weaponProf.value.${catKey}"]`).first();
      const $ol = $allCb.closest("ol.trait-list");
      if (!$ol.length) continue;

      // Basisname aus dem "Alle"-Checkbox-Name ableiten:
      // z.B. "system.traits.weaponProf.value.sim" → "system.traits.weaponProf.value"
      const allName = $allCb.attr("name") ?? "";
      const baseName = allName.slice(0, allName.lastIndexOf("."));
      if (!baseName) continue;

      for (const [itemKey, itemData] of Object.entries(cat.items)) {
        const itemLabel = typeof itemData === "string" ? itemData : itemData.label;
        if ($ol.find(`dnd5e-checkbox[name$=".weaponProf.value.${itemKey}"]`).length) continue;

        // KEIN clone() — frisches Element erstellen damit ElementInternals
        // (Form-Association) korrekt initialisiert wird.
        // Struktur muss zur dnd5e-CSS passen:
        //   <li><label class="name">...</label><div class="proficiency"><dnd5e-checkbox/></div></li>
        const li = document.createElement("li");
        const lbl = document.createElement("label");
        lbl.className = "name";
        lbl.textContent = itemLabel;
        const profDiv = document.createElement("div");
        profDiv.className = "proficiency";
        const cb = document.createElement("dnd5e-checkbox");
        cb.setAttribute("name", `${baseName}.${itemKey}`);
        if (profSet?.has?.(itemKey)) cb.setAttribute("checked", "");
        profDiv.appendChild(cb);
        li.appendChild(lbl);
        li.appendChild(profDiv);
        $ol[0].appendChild(li);
      }
    }
  }

  function _injectMissingToolItems($h, toolsData) {
    for (const [catKey, cat] of Object.entries(KS_TOOLS)) {
      let $container = null;
      let $tmpl = null;

      // Container via vorhandene Items dieser Kategorie finden
      for (const itemKey of Object.keys(cat.items)) {
        const $f = $h.find(`[data-key="tool:${itemKey}"], [data-key="${itemKey}"]`);
        if ($f.length) { $container = $f.first().parent(); $tmpl = $f.first(); break; }
      }

      // Fallback: Container via Kategorie-Header ("Alle X") finden
      if (!$container) {
        const $all = $h.find(`[data-key="tool:${catKey}"], [data-key="${catKey}"]`);
        if ($all.length) {
          $container = $all.first().parent();
          $tmpl = $h.find("li[data-key]")
            .filter(function () {
              const k = _norm($(this).data("key") ?? "");
              return k && !KS_CAT_KEYS.has(k);
            }).first();
        }
      }
      if (!$container || !$tmpl) continue;

      const tmplKey = _norm($tmpl.data("key") ?? "");
      const usesPfx = String($tmpl.data("key") ?? "").includes(":");

      // Tag-Name und Namens-Muster des Proficiency-Elements aus Template ableiten
      const $tmplPc    = $tmpl.find("[name*='.tools.']").first();
      const pcTag      = $tmplPc.length ? $tmplPc[0].tagName.toLowerCase() : "proficiency-cycle";
      const tmplPcName = $tmplPc.attr("name") ?? `system.tools.${tmplKey}.value`;

      for (const [itemKey, itemLabel] of Object.entries(cat.items)) {
        // Bereits im DOM?
        if ($container.find(`[data-key="tool:${itemKey}"], [data-key="${itemKey}"]`).length) continue;

        const fullKey   = usesPfx ? `tool:${itemKey}` : itemKey;
        const newPcName = tmplPcName.replace(new RegExp(`\\.${tmplKey}\\b`, "g"), `.${itemKey}`);
        const toolVal   = toolsData?.[itemKey]?.value ?? 0;

        // Frisches <li> erstellen — kein clone() → kein ElementInternals-Problem
        const li = document.createElement("li");
        li.setAttribute("data-key", fullKey);
        if ($tmpl[0].className) li.className = $tmpl[0].className;

        const $tmplLbl = $tmpl.find("label").not(":has(input)").first();
        const lbl = document.createElement("label");
        if ($tmplLbl[0]?.className) lbl.className = $tmplLbl[0].className;
        lbl.textContent = itemLabel;

        // Frisches Proficiency-Element (KEIN clone)
        const pc = document.createElement(pcTag);
        pc.setAttribute("name", newPcName);
        if (toolVal) pc.setAttribute("value", String(toolVal));
        // Weitere Attribute vom Template übernehmen (z.B. max, data-*)
        if ($tmplPc[0]) {
          for (const attr of $tmplPc[0].attributes) {
            if (attr.name !== "name" && attr.name !== "value") {
              pc.setAttribute(attr.name, attr.value);
            }
          }
        }

        li.appendChild(lbl);
        li.appendChild(pc);
        $container[0].appendChild(li);
      }
    }
  }


  // Normalisiert alle denkbaren Key-Formate auf den reinen Schlüssel:
  //   "tool:alchemist"            → "alchemist"
  //   "weapon:sim"                → "sim"
  //   "system.tools.chess.value"  → "chess"
  function _norm(raw) {
    return String(raw ?? "")
      .replace(/^(?:tool|weapon|armor|language|sim|mar):/, "")
      .replace(/^.*\.tools\./, "")
      .replace(/^.*\.weapons\./, "")
      .replace(/^.*\.armor\./, "")
      .replace(/\.value$/, "")
      .trim();
  }

  // Gibt ein jQuery-Objekt zurück, egal ob AppV1 oder AppV2
  function _$el(el) {
    if (!el) return $();
    if (el instanceof jQuery) return el;
    if (el instanceof Element) return $(el);
    try { return $(el); } catch { return $(); }
  }

  function patchDialog($h, trait, app) {
    if (!$h.length) return;

    if (trait === "tool") {
      $h.find("li[data-key], [data-key]").each(function () {
        const $li = $(this);
        const key = _norm($li.data("key") ?? "");
        if (!key) return;
        if (KS_CAT_KEYS.has(key)) return;             // Kategorie-Zeile behalten
        if (!KS_TOOL_KEYS.has(key)) { $li.hide(); return; }
        $li.show();
        $li.find("label").not(":has(input)").first().text(KS_TOOL_FLAT[key]);
      });
      // dnd5e 2.x Fallback: input[name*=".tools."]
      $h.find("input[name*='.tools.']").each(function () {
        const $row = $(this).closest("li, .form-group, tr");
        const key  = _norm($(this).attr("name") ?? "");
        if (!KS_TOOL_KEYS.has(key)) { $row.hide(); return; }
        $row.show();
        $row.find("label").not(":has(input)").first().text(KS_TOOL_FLAT[key]);
      });
      // Fehlende Items nachinjectieren (Strategie F)
      const _tActor = app?.document ?? app?.actor ?? app?.object;
      _injectMissingToolItems($h, _tActor?.system?.tools ?? {});
    }

    if (trait === "weapon" || trait === "sim" || trait === "mar") {
      // WeaponsConfig (dnd5e 4.x AppV2): kein data-key, stattdessen
      //   <li><label class="name">Club</label>
      //       <dnd5e-checkbox name="system.traits.weaponProf.value.club"></dnd5e-checkbox>
      $h.find("ol.trait-list li").each(function () {
        const $li = $(this);
        const $cb = $li.find("dnd5e-checkbox[name*='.weaponProf.value.']")
                        .not("[name*='.mastery.']").first();
        if (!$cb.length) return;
        const key = ($cb.attr("name") ?? "").split(".").pop();
        if (!key || key === "sim" || key === "mar") return; // Kategorien behalten
        if (!KS_WEAPON_FLAT[key]) { $li.hide(); return; }
        $li.show();
        $li.find("label.name").first().text(KS_WEAPON_FLAT[key]);
      });
      const _actor = app?.document ?? app?.actor ?? app?.object;
      const _profSet = _actor?.system?.traits?.weaponProf?.value ?? new Set();
      _injectMissingWeaponItems($h, _profSet);
    }

    if (trait === "armor") {
      // KS_ARMOR_FLAT hat jetzt lgt/hvy/shl als Keys (dnd5e-native).
      // Strategie: Kategorie-<li> (lgt/hvy/shl) umbenennen, Einzelitems + med ausblenden,
      // dann alle 3 Kategorie-Items in EINEN Fieldset "Rüstungen" zusammenführen.
      const $toMove = [];
      $h.find("fieldset.traits.card ol.trait-list li").each(function () {
        const $li = $(this);
        const $cb = $li.find("dnd5e-checkbox[name*='.armorProf.value.']").first();
        if (!$cb.length) { $li.hide(); return; }
        const key = ($cb.attr("name") ?? "").split(".").pop();
        if (KS_ARMOR_FLAT[key]) {
          $li.find("label.name").first().text(KS_ARMOR_FLAT[key]);
          $toMove.push($li[0]);
        } else {
          $li.hide();
        }
      });
      if ($toMove.length) {
        // Ersten Fieldset nehmen → Ziel-Container
        const $first = $h.find("fieldset.traits.card").first();
        const $ol    = $first.find("ol.trait-list").first();
        $first.find("> legend, > .category-label").first().text("Rüstungen");
        $ol.empty();
        for (const li of $toMove) $ol.append(li);
        // Alle anderen Fieldsets ausblenden
        $h.find("fieldset.traits.card").not($first).hide();
      }
    }
  }

  function _trait(app, data) {
    return data?.trait ?? data?.attribute
      ?? app?.options?.trait ?? app?.options?.attribute
      ?? app?.attribute ?? app?.trait ?? "";
  }

  // Alle möglichen Render-Hook-Namen (AppV1 + AppV2 + dnd5e-spezifisch)
  const RENDER_HOOKS = [
    "renderApplication",          // AppV1 generisch
    "renderApplicationV2",        // AppV2 generisch (Foundry V12)
    "renderProficiencyConfig",    // dnd5e 3.x
    "renderTraitSelector",        // dnd5e 2.x
    "renderActorTraitConfig",     // möglicher Alias
    "renderTraitConfig",
  ];

  for (const hookName of RENDER_HOOKS) {
    Hooks.on(hookName, (app, el, data) => {
      const $h = _$el(el);
      if (!$h.length) return;

      let trait = _trait(app, data);
      const appName = app?.constructor?.name ?? "";

      // Diagnose: bei JEDEM Proficiency/Trait-Dialog loggen (auch ohne data-key)
      const looksLikeProf = ["proficiency","trait","config","selector"].some(w => appName.toLowerCase().includes(w));
      const $keys = $h.find("[data-key]");
      const $vals = $h.find("[data-value]");
      if (looksLikeProf || $keys.length || $vals.length) {
        const sk = [...$keys].slice(0, 6).map(e => e.getAttribute("data-key")).join(" | ");
        const sv = [...$vals].slice(0, 6).map(e => e.getAttribute("data-value")).join(" | ");
        console.log(`KS | ${hookName} | app=${appName} | trait="${trait}" | app.attr="${app?.attribute}" | opts.attr="${app?.options?.attribute}" | [data-key]: ${sk || "(none)"} | [data-value]: ${sv || "(none)"}`);
        // HTML-Dump für unbekannte Dialoge
        if (!$keys.length && !$vals.length) {
          console.log(`KS | ${appName} HTML:`, $h[0]?.innerHTML?.slice(0, 3000));
        }
      }

      // Fallback: Trait aus data-key-Einträgen im HTML ableiten
      if (!trait) {
        if ($h.find("[data-key*='tool'], [data-value*='tool']").length)   trait = "tool";
        else if ($h.find("[data-key*='weapon'], [data-key='sim'], [data-key^='sim:'], [data-key='mar'], [data-key^='mar:'], [data-value='sim'], [data-value='mar'], [data-value*='weapon']").length) trait = "weapon";
        else if ($h.find("[data-key*='armor'], [data-value*='armor']").length)  trait = "armor";
        else if ($h.find("input[name*='.tools.']").length) trait = "tool";
      }

      // "sim"/"mar" → "weapon" normalisieren
      if (trait === "sim" || trait === "mar") trait = "weapon";

      if (trait) patchDialog($h, trait, app);
    });
  }

  console.log(
    `Ketsushin | v0.1.4 bereit. ` +
    `Trait.choices: ${Trait?.choices ? "gepatcht ✓" : "nicht gefunden"} | ` +
    `buildTraitChoices: registriert ✓ | DOM-Hooks: ${RENDER_HOOKS.length} registriert ✓`
  );
});

