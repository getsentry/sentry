import React from 'react';
import {Select2Field} from '../../components/forms';

function getChoiceField(name, data) {
  return (
    <Select2Field
      name={name}
      choices={data.choices}
      key={name}
      style={{marginBottom: 0}}
    />
  );
}

function getInputField(type, name, data) {
  return (
    <input
      name={name}
      type={type}
      placeholder={data.placeholder}
      key={name}
      style={{height: 37}}
    />
  );
}

const getFieldTypes = {
  choice: getChoiceField,
  number: getInputField.bind(null, 'number'),
  string: getInputField.bind(null, 'text'),
};

function getField(name, data) {
  return getFieldTypes[data.type](name, data);
}

export function getComponent(node) {
  const {label, formFields} = node;

  return label.split(/({\w+})/).map(part => {
    if (!/^{\w+}$/.test(part)) {
      return part;
    }

    const key = part.slice(1, -1);
    return formFields[key] ? getField(key, formFields[key]) : part;
  });
}
