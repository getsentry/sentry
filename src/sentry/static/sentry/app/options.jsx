import React from 'react';
import ConfigStore from './stores/configStore';
import {t} from './locale';
import {EmailField, TextField} from './components/forms';

const definitions = {
  'system.url-prefix': {
    label: t('Root URL'),
    placeholder: 'https://sentry.example.com',
    help: t('The root web address which is used to communicate with the Sentry backend.'),
    defaultValue: () => `${document.location.protocol}//${document.location.host}`
  },
  'system.admin-email': {
    label: t('Admin Email'),
    placeholder: 'admin@example.com',
    help: t('The technical contact for this Sentry installation.'),
    // TODO(dcramer): this shoudl not be hardcoded to a component
    component: EmailField,
    defaultValue: () => ConfigStore.get('user').email
  }
};

export function getOptionField(option, onChange, value) {
  let meta = definitions[option];
  let Field = meta.component || TextField;
  return (
    <Field
        key={option}
        label={meta.label}
        defaultValue={meta.defaultValue()}
        placeholder={meta.placeholder}
        help={meta.help}
        onChange={onChange}
        required={true}
        value={value} />
  );
}

export function getOption(option) {
  return definitions[option];
}

export default definitions;
