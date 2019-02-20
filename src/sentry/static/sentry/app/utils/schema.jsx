export function getSchemaFields(schema) {
  let fields;
  if (schema.type == 'issue-link'){
    fields = issueLinkSchemaToJson(schema);
  }
  return fields
}

function schemaFieldToJsonField(field, required) {
  if (required){
    field.required = true;
  }
  switch(field.type) {
    case 'text':
      return field;
    case 'select':
      if (field.options){
        field.choices = field.options;
        return field;
      }
      return field;
    default:
      return;
  }
}

function issueLinkSchemaToJson(schema) {
  const actions = ['link', 'create'];
  let fields = {
    link: {
      fields: [],
      uri: schema.link.uri
    },
    create: {
      fields: [],
      uri: schema.create.uri
    },
  }

  actions.forEach(action => {
    setActionFields(action, schema, true, fields);
    if (schema[action].optional_fields){
      setActionFields(action, schema, false, fields);
    }
  });

  return fields;
}

function setActionFields(action, schema, required, fields) {
  const fieldsType = required ? 'required_fields' : 'optional_fields';
  schema[action][fieldsType].forEach(field => {
    const newField = schemaFieldToJsonField(field, required);
    fields[action].fields.push(newField);
  });
}
