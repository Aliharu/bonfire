// Import document classes.
import { BonfireActor } from "./documents/actor.mjs";
import { BonfireItem } from "./documents/item.mjs";
// Import sheet classes.
import { BonfireActorSheet } from "./sheets/actor-sheet.mjs";
import { BonfireItemSheet } from "./sheets/item-sheet.mjs";
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { BONFIRE } from "./helpers/config.mjs";
import { BonfireDie } from "./dice/dice.mjs";
import Importer from "./apps/importer.js";

import { BonfireCombat } from "./combat.js";
import { RollForm } from "./apps/dice-roller.js";

import { CharacterData, NpcData } from "./template/actor-template.js";
import { ItemBurdenData, ItemSkillData, ItemWeaponData, 
  ItemCharacteristicData, ItemContactData, 
  ItemData, ItemExpenditureData, 
  ItemRudimentData, ItemWoundData, ItemAttackData, 
  ItemMovementData } from "./template/item-template.js";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function() {

  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.bonfire = {
    BonfireActor,
    BonfireItem,
    rollItemMacro,
    RollForm
  };

  CONFIG.Actor.dataModels = {
    character: CharacterData,
    npc: NpcData
  }

  CONFIG.Item.dataModels = {
    burden: ItemBurdenData,
    characteristic: ItemCharacteristicData,
    contact: ItemContactData,
    item: ItemData,
    skill: ItemSkillData,
    weapon: ItemWeaponData,
    expenditure: ItemExpenditureData,
    rudiment: ItemRudimentData,
    wound: ItemWoundData,
    attack: ItemAttackData,
    movement: ItemMovementData,
  }

  // Add custom constants for configuration.
  CONFIG.BONFIRE = BONFIRE;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d4+@init.value",
    decimals: 2
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = BonfireActor;
  CONFIG.Item.documentClass = BonfireItem;
  CONFIG.Combat.documentClass = BonfireCombat;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("bonfire", BonfireActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("bonfire", BonfireItemSheet, { makeDefault: true });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here are a few useful examples:
Handlebars.registerHelper('concat', function() {
  var outStr = '';
  for (var arg in arguments) {
    if (typeof arguments[arg] != 'object') {
      outStr += arguments[arg];
    }
  }
  return outStr;
});

Handlebars.registerHelper('toLowerCase', function(str) {
  return str.toLowerCase();
});

Handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper("enrichedHTMLItems", function (sheetData, type, itemID) {
  return sheetData.itemDescriptions[itemID];
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function() {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));
});

Hooks.on("renderActorDirectory", (app, html, data) => {
  const button = $(`<button class="json-importer"><i class="fas fa-user"></i>Import</button>`);
  html.find(".directory-footer").append(button);

  button.click(ev => {
    game.importer = new Importer().render(true);
  })
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== "Item") return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn("You can only create macro buttons for owned Items");
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.bonfire.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(m => (m.name === item.name) && (m.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "bonfire.itemMacro": true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: 'Item',
    uuid: itemUuid
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then(item => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(`Could not find item ${itemName}. You may need to delete and recreate this macro.`);
    }

    // Trigger the item roll
    item.roll();
  });
}