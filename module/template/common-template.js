const fields = foundry.data.fields;

export function resourceField(initialValue, initialMax) {
    return new fields.SchemaField({
        min: new fields.NumberField({ initial: 0 }),
        value: new fields.NumberField({ initial: initialValue }),
        max: new fields.NumberField({ initial: initialMax }),
    });
}

export function statField(initialValue) {
    return new fields.SchemaField({
        min: new fields.NumberField({ initial: 0 }),
        value: new fields.NumberField({ initial: initialValue }),
    });
}

export function traitField() {
    return new fields.SchemaField({
        value: new fields.ArrayField(new fields.StringField({ initial: ""})),
        custom: new fields.StringField({ initial: "" }),
    });
}

export function advancedSkillField(label, baseCost) {
    return new fields.SchemaField({
        value: new fields.NumberField({ initial: 0 }),
        label: new fields.StringField({ initial: label }),
        baseCost: new fields.NumberField({ initial: baseCost }),
    });
}

export function skillSuiteField(name) {
    return new fields.SchemaField({
        value: new fields.NumberField({ initial: 0 }),
        label: new fields.StringField({ initial: name }),
        trained: new fields.BooleanField({ initial: false }),
    });
}

export function activatableData() {
    return {
        activatable: new fields.BooleanField({ initial: false }),
        active: new fields.BooleanField({ initial: false }),
        endtrigger: new fields.StringField({ initial: "none" }),
    };
}