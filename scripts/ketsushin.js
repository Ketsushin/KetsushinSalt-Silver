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
      airVehicle:   "Luftfahrzeug",
      landVehicle:  "Landfahrzeug",
      waterVehicle: "Wasserfahrzeug"
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

  CONFIG.DND5E.armorTypes = {
    clothing: "Normale Kleidung",
    light:    "Leichte Rüstung",
    heavy:    "Schwere Rüstung",
    shield:   "Schild"
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
    streitkolben:   { label: "Streitkolben",      type: "simpleM" },
    leichtArmbrust: { label: "Leichte Armbrust",  type: "simpleR" },
    leichtHammer:   { label: "Leichter Hammer",   type: "simpleR" },
    kurzbogen:      { label: "Kurzbogen",         type: "simpleR" },
    leichtPistole:  { label: "Leichte Pistole",   type: "simpleR" },
    schleuder:      { label: "Schleuder",         type: "simpleR" }
  };

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

  // ── Strategie D: DOM-Patch (AppV1 jQuery + AppV2 HTMLElement) ───────────
  // Normalisiert alle denkbaren Key-Formate auf den reinen Schlüssel:
  //   "tool:alchemist"            → "alchemist"
  //   "weapon:sim"                → "sim"
  //   "system.tools.chess.value"  → "chess"
  function _norm(raw) {
    return String(raw ?? "")
      .replace(/^(?:tool|weapon|armor|language):/, "")
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

  function patchDialog($h, trait) {
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
    }

    if (trait === "weapon") {
      $h.find("li[data-key]").each(function () {
        const $li = $(this);
        const key = _norm($li.data("key") ?? "");
        if (!key || ["sim", "mar"].includes(key)) return; // Kategorien behalten
        if (!KS_WEAPON_FLAT[key]) { $li.hide(); return; }
        $li.show();
        $li.find("label").not(":has(input)").first().text(KS_WEAPON_FLAT[key]);
      });
    }

    if (trait === "armor") {
      $h.find("li[data-key]").each(function () {
        const $li = $(this);
        const key = _norm($li.data("key") ?? "");
        if (!key) return;
        if (KS_ARMOR_FLAT[key]) {
          $li.show();
          $li.find("label").not(":has(input)").first().text(KS_ARMOR_FLAT[key]);
        } else if (!["light", "medium", "heavy", "shield"].includes(key)) {
          $li.hide();
        }
      });
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

      // Trait aus App-Optionen oder Daten ermitteln
      let trait = _trait(app, data);

      // Fallback: Trait aus data-key-Einträgen im HTML ableiten
      if (!trait) {
        if ($h.find("[data-key*='tool']").length)   trait = "tool";
        else if ($h.find("[data-key*='weapon']").length) trait = "weapon";
        else if ($h.find("[data-key*='armor']").length)  trait = "armor";
        else if ($h.find("input[name*='.tools.']").length) trait = "tool";
      }

      if (trait) patchDialog($h, trait);
    });
  }

  console.log(
    `Ketsushin | v0.1.4 bereit. ` +
    `Trait.choices: ${Trait?.choices ? "gepatcht ✓" : "nicht gefunden"} | ` +
    `buildTraitChoices: registriert ✓ | DOM-Hooks: ${RENDER_HOOKS.length} registriert ✓`
  );
});

