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
  const pattern = /{\w+}/g;
  const res = [];
  const text = label.split(pattern);
  const matches = (label.match(pattern) || []).map(match => {
    const key = match.slice(1, -1);
    const fieldData = formFields[key];
    return fieldData ? getField(key, fieldData) : match;
  });

  while (text.length) {
    res.push(text.shift());
    if (matches.length) {
      res.push(matches.shift());
    }
  }

  return res;
}
