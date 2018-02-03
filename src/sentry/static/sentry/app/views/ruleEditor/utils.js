/*eslint no-use-before-define:0*/

export function getHtmlForNode(node) {
  let {label, formFields} = node;
  let pattern = /{(\w+)}/g;
  return label.replace(pattern, (str, match) => {
    const fieldData = formFields[match];
    if (fieldData) {
      return getField(match, fieldData);
    } else {
      return str;
    }
  });
}

function getField(name, data) {
  const getFieldTypes = {
    choice: getChoiceField,
    number: getInputField.bind(null, 'number'),
    string: getInputField.bind(null, 'text'),
  };
  return getFieldTypes[data.type](name, data);
}

function getChoiceField(name, data) {
  return `<select name="${name}">
    ${data.choices.map(opt => `<option value=${opt[0]}>${opt[1]}</option>`)}
  </select>`;
}

function getInputField(type, name, data) {
  return `<input name="${name}" type="${type}" placeholder="${data.placeholder}"></input>`;
}
