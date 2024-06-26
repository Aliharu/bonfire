import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { RollForm } from "../apps/dice-roller.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class BonfireActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["bonfire", "sheet", "actor"],
      template: "systems/bonfire/templates/actor/actor-sheet.html",
      width: 880,
      height: 880,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills" }]
    });
  }

  /** @override */
  get template() {
    return `systems/bonfire/templates/actor/actor-${this.actor.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = this.document.toPlainObject();

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.attacks = actorData.attacks;
    context.flags = actorData.flags;

    // Enrich biography info for display
    // Enrichment turns text like `[[/r 1d20]]` into buttons
    context.enrichedBiography = await TextEditor.enrichHTML(
      this.actor.system.biography,
      {
        // Whether to show secret blocks in the finished html
        secrets: this.document.isOwner,
        // Necessary in v11, can be removed in v12
        async: true,
        // Data to fill in for inline rolls
        rollData: this.actor.getRollData(),
        // Relative UUID resolution
        relativeTo: this.actor,
      }
    );

    // Prepare character data and items.
    if (actorData.type == 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if (actorData.type == 'npc') {
      this._prepareItems(context);
    }

    context.itemDescriptions = {};
    for (let item of this.actor.items) {
      context.itemDescriptions[item.id] = await TextEditor.enrichHTML(item.system.description, { async: true, secrets: this.actor.isOwner, relativeTo: item });
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.actor.effects);
    context.selects = CONFIG.BONFIRE.selects;

    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterData(context) {
    // Handle attribute scores.
    for (let [k, v] of Object.entries(context.system.attributes)) {
      v.label = game.i18n.localize(CONFIG.BONFIRE.attributes[k]) ?? k;
    }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
    const attacks = [];
    const weapons = [];
    const skills = [];
    const wounds = [];
    const burdens = [];
    const expenditures = [];
    const rudiments = [];
    const contacts = [];
    const movements = [];
    const characteristics = {
      devotions: [],
      descriptions: [],
      convictions: [],
      reputations: [],
      contacts: [],
      flaws: [],
    };

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;
      // Append to gear.
      if (i.type === 'item') {
        gear.push(i);
      }
      if (i.type === 'attack') {
        attacks.push(i);
      }
      if (i.type === 'weapon') {
        weapons.push(i);
      }
      if (i.type === 'skill') {
        skills.push(i);
      }
      if (i.type === 'burden') {
        burdens.push(i);
      }
      if (i.type === 'wound') {
        wounds.push(i);
      }
      if (i.type === 'expenditure') {
        expenditures.push(i);
      }
      if (i.type === 'rudiment') {
        rudiments.push(i);
      }
      if (i.type === 'contact') {
        contacts.push(i);
      }
      if (i.type === 'movement') {
        movements.push(i);
      }
      if (i.type === 'characteristic') {
        switch (i.system.type) {
          case 'devotion':
            characteristics['devotions'].push(i);
            break;
          case 'description':
            characteristics['descriptions'].push(i);
            break;
          case 'conviction':
            characteristics['convictions'].push(i);
            break;
          case 'reputation':
            characteristics['reputations'].push(i);
            break;
          case 'flaw':
            characteristics['flaws'].push(i);
            break;
        }
      }
    }

    // Assign and return
    context.gear = gear;
    if(context.type === 'npc') {
      context.attacks = attacks;
    }
    context.weapons = weapons;
    context.characteristics = characteristics;
    context.contacts = contacts;
    context.skills = skills;
    context.wounds = wounds;
    context.burdens = burdens;
    context.expenditures = expenditures;
    context.rudiments = rudiments;
    context.movements = movements;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    html.find('.item-attack').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      if (item) return item.attack();
    });

    html.find('.item-row').click(ev => {
      const li = $(ev.currentTarget).next();
      li.toggle("fast");
    });

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    html.find('.toggle-equipped').click(ev => {
      ev.preventDefault();
      ev.stopPropagation();
      let li = $(ev.currentTarget).parents(".item");
      let item = this.actor.items.get(li.data("item-id"));
      item.update({
        [`system.equipped`]: !item.system.equipped,
      });
    });

    html.find('.toggle-equipped-shield').click(ev => {
      ev.preventDefault();
      ev.stopPropagation();
      this.actor.update({
        [`system.shield.equipped`]: !this.actor.system.shield.equipped,
      });
    });

    html.find('.toggle-equipped-armor').click(ev => {
      ev.preventDefault();
      ev.stopPropagation();
      this.actor.update({
        [`system.armor.equipped`]: !this.actor.system.armor.equipped,
      });
    });

    html.find('.attack-button').mousedown(ev => {
      new RollForm(this.actor, { event: ev }, {}, { 'attackId': ev.currentTarget.dataset.id, 'dialogType': ev.currentTarget.dataset.dialog, 'index': ev.currentTarget.dataset.index }).render(true);
    });

    html.find('.spell-button').mousedown(async ev => {
      let confirmed = false;
      const html = await renderTemplate("systems/bonfire/templates/dialogues/cast-spell.html");
      new Dialog({
        title: `Cast Spell`,
        content: html,
        buttons: {
          roll: { label: "Cast", callback: () => confirmed = true },
          cancel: { label: "Cancel", callback: () => confirmed = false }
        },
        render: (html) => {
          html.find('.effect').on('change', async (ev) => {
            let effect = parseInt(html.find('#effect').val());
            let order = parseInt(html.find('#order').val());
            let origin = parseInt(html.find('#origin').val());
            let interval = parseInt(html.find('#interval').val());
            let spellPoints = parseInt(html.find('#spellPoints').val());
            var totalDrain = ((effect * order) * interval) + origin;
            var orderAllowance = ((spellPoints - origin) / effect) / interval;

            $("#totalDrain").text(totalDrain);
            $("#orderAllowance").text(Math.floor(orderAllowance));
          });
        },
        close: html => {
          if (confirmed) {
            let effect = parseInt(html.find('#effect').val());
            let order = parseInt(html.find('#order').val());
            let origin = parseInt(html.find('#origin').val());
            let interval = parseInt(html.find('#interval').val());
            let spellName = html.find('#spellName').val();
            var totalDrain = ((effect * order) * interval) + origin;

            const speaker = ChatMessage.getSpeaker({ actor: this.actor });

            ChatMessage.create({
              speaker: speaker,
              flavor: `Spell Cast: ${spellName}`,
              content: `<div>Order: ${order}</div><div>Origin: ${origin}</div><div>Effect: ${effect}</div><div>Interval: ${interval}</div><div>Total Drain: ${totalDrain}</div>`
            });
          }
        }
      }, { classes: ["dialog"] }).render(true);
    });

    // Active Effect management
    html.find(".effect-control").click(ev => onManageActiveEffect(ev, this.actor));

    // Rollable attribute.
    html.find('.rollable').click(this._onRoll.bind(this));

    html.find('.item-attack-test').click(ev => {
      // const weaponChart = await foundry.utils.fetchJsonWithTimeout('systems/exaltedthird/module/data/bonfire_weapons.json', {}, { int: 30000 });

      // const weaponTotal = {};
      // for(const weapon of weaponChart) {
      //   let valTotal = 0;
      //   for(let i = 0; i < 10000; i++) {z
      //     var roll = new Roll(weapon.formula).evaluate({ async: false });
      //     let rollTotal = roll.total / weapon.speed;
      //     valTotal += rollTotal;
      //   }
      //   valTotal /= 10000;
      //   console.log(`${weapon.name}:${valTotal}`);
      //   weaponTotal[weapon.name] = valTotal;        
      // }
      // const weaponTotal = {};
      // for(const dieRoll of [2,3,4,6,8,10,12,20]) {
      //   let valTotal = 0;
      //   for(let i = 0; i < 10000; i++) {
      //     var roll = new Roll(`1d${dieRoll}x${dieRoll}`).evaluate({ async: false });
      //     let rollTotal = roll.total;
      //     valTotal += rollTotal;
      //   }
      //   valTotal /= 10000;
      //   weaponTotal[dieRoll] = valTotal;    
      // }
      // console.log(
      //   weaponTotal
      // );

      var mail = 0;
      var flail = 0;

      for (let i = 0; i < 10; i++) {
        var playerRoll = new Roll(`1d20`).evaluate({ async: false });
        mail += playerRoll.total;
      }
      for (let i = 0; i < 7; i++) {
        var playerRoll = new Roll(`2d12`).evaluate({ async: false });
        flail += playerRoll.total;
      }

      // Flail: 36
      // Maul: 57

      console.log(`Flail: ${flail}`);
      console.log(`Maul: ${mail}`);


      // var playerSucceeded = 0;
      // var playerPerfectAttacks = 0;
      // for (let j = 0; j < 10000; j++) {
      //   var explosionRoll = null;
      //   var playerRoll = new Roll(`1d20`).evaluate({ async: false });
      //   var playerTotal = playerRoll.total;
      //   if (playerRoll.dice[0].results[0].result === 20) {
      //     explosionRoll = new Roll(`1d6x6`).evaluate({ async: false });
      //     playerTotal += explosionRoll.total;
      //   }
      //   var gmRoll = new Roll(`1d20`).evaluate({ async: false });
      //   var gmTotal = gmRoll.total;
      //   if (playerRoll.dice[0].results[0].result === 20) {
      //     explosionRoll = new Roll(`1d6x6`).evaluate({ async: false });
      //     gmTotal += explosionRoll.total;
      //   }

      //   if (gmTotal < playerTotal) {
      //     playerSucceeded++;
      //   }
      //   if(playerTotal >= 20) {
      //     playerPerfectAttacks++;
      //   }
      // }
      // console.log(`Player succeeded ${(playerSucceeded / 10000) * 100}% of the time on an attack check, ${(playerPerfectAttacks / 10000) * 100}% perfect attacks`)


      // var total1 = 0;
      // var total2 = 0;
      // for (let j = 0; j < 10000; j++) {
      //   var explosionRoll = null;
      //   var playerRoll = new Roll(`2d8x8`).evaluate({ async: false });
      //   total1 += playerRoll.total;
      //   var playerRoll2 = new Roll(`1d10x10 + 1d8x8`).evaluate({ async: false });
      //   total2 += playerRoll2.total;
      // }

      // console.log(`Player succeeded ${(total1 / 10000)} normal attack average, ${(total2 / 10000)} Power attack average`)

      // for (let i = 10; i <= 30; i += 5) {
      //   var playerSucceeded = 0;
      //   for (let j = 0; j < 10000; j++) {
      //     var explosionRoll = null;
      //     var playerRoll = new Roll(`1d20+20`).evaluate({ async: false });
      //     var playerTotal = playerRoll.total;
      //     if (playerRoll.dice[0].results[0].result) {
      //       explosionRoll = new Roll(`1d6x6`).evaluate({ async: false });
      //       playerTotal += explosionRoll.total;
      //     }
      //     var gmRoll = new Roll(`1d20+${i}`).evaluate({ async: false });
      //     var gmTotal = gmRoll.total;
      //     if (playerRoll.dice[0].results[0].result) {
      //       explosionRoll = new Roll(`1d6x6`).evaluate({ async: false });
      //       gmTotal += explosionRoll.total;
      //     }

      //     if (gmTotal <= playerTotal) {
      //       playerSucceeded++;
      //     }
      //   }
      //   const mapThing = {
      //     10: 'Routine',
      //     15: 'Easy',
      //     20: 'Average',
      //     25: 'Hard',
      //     30: 'Challenging',
      //   }
      //   console.log(`Player succeeded ${(playerSucceeded / 10000) * 100}% of the time on a ${mapThing[i]} check`)
      // }
    });

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = foundry.utils.duplicate(header.dataset); 
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system["type"];

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `[attribute] ${dataset.label}` : '';
      let rollString = dataset.roll;
      if (dataset.type === 'skill') {
        if (this.actor.system.skillSuites[dataset.skill].trained) {
          rollString = `d20x+@skillSuites.${dataset.skill}.value+@skillSuites.${dataset.skill}.mod`;
        }
        else {
          rollString = `d12x+@skillSuites.${dataset.skill}.value+@skillSuites.${dataset.skill}.mod`;
        }
      }
      let roll = new Roll(rollString, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }

}
