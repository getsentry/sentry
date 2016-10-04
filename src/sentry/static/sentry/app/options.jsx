import React from 'react';
import _ from 'underscore';
import ConfigStore from './stores/configStore';
import {t} from './locale';
import {EmailField, TextField, BooleanField} from './components/forms';

// This are ordered based on their display order visually
const sections = [
  {
    key: 'system',
  },
  {
    key: 'mail',
    heading: t('Outbound email'),
  }
];

// This are ordered based on their display order visually
const definitions = [
  {
    key: 'system.url-prefix',
    label: t('Root URL'),
    placeholder: 'https://sentry.example.com',
    help: t('The root web address which is used to communicate with the Sentry backend.'),
    defaultValue: () => `${document.location.protocol}//${document.location.host}`,
  },
  {
    key: 'system.admin-email',
    label: t('Admin Email'),
    placeholder: 'admin@example.com',
    help: t('The technical contact for this Sentry installation.'),
    // TODO(dcramer): this should not be hardcoded to a component
    component: EmailField,
    defaultValue: () => ConfigStore.get('user').email,
  },
  {
    key: 'system.rate-limit',
    label: t('Rate Limit'),
    placeholder: 'e.g. 500',
    help: t('The maximum number of events the system should accept per minute. A value of 0 will disable the default rate limit.'),
  },
  {
    key: 'auth.ip-rate-limit',
    label: t('IP Rate Limit'),
    placeholder: 'e.g. 10',
    help: t('The maximum number of times an authentication attempt may be made by a single IP address in a 60 second window.'),
  },
  {
    key: 'auth.user-rate-limit',
    label: t('User Rate Limit'),
    placeholder: 'e.g. 10',
    help: t('The maximum number of times an authentication attempt may be made against a single account in a 60 second window.'),
  },
  {
    key: 'api.rate-limit.org-create',
    label: 'Organization Creation Rate Limit',
    placeholder: 'e.g. 5',
    help: t('The maximum number of organizations which may be created by a single account in a one hour window.'),
  },
  {
    key: 'mail.from',
    label: t('Email From'),
    component: EmailField,
    defaultValue: () => `sentry@${document.location.hostname}`,
    help: t('Email address to be used in From for all outbound email.')
  },
  {
    key: 'mail.host',
    label: t('SMTP Host'),
    placeholder: 'localhost',
    defaultValue: () => 'localhost',
  },
  {
    key: 'mail.port',
    label: t('SMTP Port'),
    placeholder: '25',
    defaultValue: () => '25',
  },
  {
    key: 'mail.username',
    label: t('SMTP Username'),
    defaultValue: () => '',
  },
  {
    key: 'mail.password',
    label: t('SMTP Password'),
    // TODO(mattrobenolt): We don't want to use a real password field unless
    // there's a way to reveal it. Without being able to see the password, it's
    // impossible to confirm if it's right.
    // component: PasswordField,
    defaultValue: () => '',
  },
  {
    key: 'mail.use-tls',
    label: t('Use TLS?'),
    component: BooleanField,
    defaultValue: () => false,
  },
];

const definitionsMap = _.indexBy(definitions, 'key');

const disabledReasons = {
  diskPriority: 'This setting is defined in config.yml and may not be changed via the web UI.',
  smtpDisabled: 'SMTP mail has been disabled, so this option is unavailable',
};

export function getOption(option) {
  return definitionsMap[option];
}

function optionsForSection(section) {
  return definitions.filter(option => option.key.split('.')[0] === section.key);
}

export function getOptionField(option, onChange, value, field) {
  let meta = {...getOption(option), ...field};
  let Field = meta.component || TextField;
  return (
    <Field
        name={option}
        key={option}
        label={meta.label}
        defaultValue={meta.defaultValue ? meta.defaultValue() : undefined}
        placeholder={meta.placeholder}
        help={meta.help}
        onChange={onChange}
        required={meta.required && !meta.allowEmpty}
        value={value}
        disabled={meta.disabled}
        disabledReason={meta.disabledReason && disabledReasons[meta.disabledReason]} />
  );
}

function getSectionFieldSet(section, fields) {
  return (
    <fieldset key={section.key}>
      {section.heading && <legend>{section.heading}</legend>}
      {fields}
    </fieldset>
  );
}

export function getForm(fields) {
  // fields is a object mapping key name to Fields, so the goal is to split
  // them up into multiple sections, and spit out fieldsets with a grouping of
  // all fields, in the right order, under their section.
  let sets = [];
  for (let section of sections) {
    let set = [];
    for (let option of optionsForSection(section)) {
      if (fields[option.key]) {
        set.push(fields[option.key]);
      }
    }
    if (set.length) {
      sets.push(getSectionFieldSet(section, set));
    }
  }
  return sets;
}
