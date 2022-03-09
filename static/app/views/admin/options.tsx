import * as React from 'react';
import keyBy from 'lodash/keyBy';

import {
  BooleanField,
  EmailField,
  RadioBooleanField,
  TextField,
} from 'sentry/components/forms';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';

type Section = {
  key: string;
  heading?: string;
};

type Field = {
  key: string;
  label: React.ReactNode;
  allowEmpty?: boolean;
  component?: React.ComponentType<any>;
  defaultValue?: () => string | false;
  disabled?: boolean;
  disabledReason?: string;
  help?: React.ReactNode;
  noLabel?: string;
  placeholder?: string;
  required?: boolean;
  yesFirst?: boolean;
  yesLabel?: string;
};

// This are ordered based on their display order visually
const sections: Section[] = [
  {
    key: 'system',
  },
  {
    key: 'mail',
    heading: t('Outbound email'),
  },
  {
    key: 'auth',
    heading: t('Authentication'),
  },
  {
    key: 'beacon',
    heading: t('Beacon'),
  },
];

// This are ordered based on their display order visually
const definitions: Field[] = [
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
    key: 'system.support-email',
    label: t('Support Email'),
    placeholder: 'support@example.com',
    help: t('The support contact for this Sentry installation.'),
    // TODO(dcramer): this should not be hardcoded to a component
    component: EmailField,
    defaultValue: () => ConfigStore.get('user').email,
  },
  {
    key: 'system.security-email',
    label: t('Security Email'),
    placeholder: 'security@example.com',
    help: t('The security contact for this Sentry installation.'),
    // TODO(dcramer): this should not be hardcoded to a component
    component: EmailField,
    defaultValue: () => ConfigStore.get('user').email,
  },
  {
    key: 'system.rate-limit',
    label: t('Rate Limit'),
    placeholder: 'e.g. 500',
    help: t(
      'The maximum number of events the system should accept per minute. A value of 0 will disable the default rate limit.'
    ),
  },
  {
    key: 'auth.allow-registration',
    label: t('Allow Registration'),
    help: t('Allow anyone to create an account and access this Sentry installation.'),
    component: BooleanField,
    defaultValue: () => false,
  },
  {
    key: 'auth.ip-rate-limit',
    label: t('IP Rate Limit'),
    placeholder: 'e.g. 10',
    help: t(
      'The maximum number of times an authentication attempt may be made by a single IP address in a 60 second window.'
    ),
  },
  {
    key: 'auth.user-rate-limit',
    label: t('User Rate Limit'),
    placeholder: 'e.g. 10',
    help: t(
      'The maximum number of times an authentication attempt may be made against a single account in a 60 second window.'
    ),
  },
  {
    key: 'api.rate-limit.org-create',
    label: 'Organization Creation Rate Limit',
    placeholder: 'e.g. 5',
    help: t(
      'The maximum number of organizations which may be created by a single account in a one hour window.'
    ),
  },
  {
    key: 'beacon.anonymous',
    label: 'Usage Statistics',
    component: RadioBooleanField,
    // yes and no are inverted here due to the nature of this configuration
    noLabel: 'Send my contact information along with usage statistics',
    yesLabel: 'Please keep my usage information anonymous',
    yesFirst: false,
    help: tct(
      'If enabled, any stats reported to sentry.io will exclude identifying information (such as your administrative email address). By anonymizing your installation the Sentry team will be unable to contact you about security updates. For more information on what data is sent to Sentry, see the [link:documentation].',
      {
        link: <a href="https://develop.sentry.dev/self-hosted/" />,
      }
    ),
  },
  {
    key: 'mail.from',
    label: t('Email From'),
    component: EmailField,
    defaultValue: () => `sentry@${document.location.hostname}`,
    help: t('Email address to be used in From for all outbound email.'),
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
    label: t('Use STARTTLS? (exclusive with SSL)'),
    component: BooleanField,
    defaultValue: () => false,
  },
  {
    key: 'mail.use-ssl',
    label: t('Use SSL? (exclusive with STARTTLS)'),
    component: BooleanField,
    defaultValue: () => false,
  },
];

const definitionsMap = keyBy(definitions, def => def.key);

const disabledReasons = {
  diskPriority:
    'This setting is defined in config.yml and may not be changed via the web UI.',
  smtpDisabled: 'SMTP mail has been disabled, so this option is unavailable',
};

export function getOption(option: string): Field {
  return definitionsMap[option];
}

export function getOptionDefault(option: string): string | false | undefined {
  const meta = getOption(option);
  return meta.defaultValue ? meta.defaultValue() : undefined;
}

function optionsForSection(section: Section) {
  return definitions.filter(option => option.key.split('.')[0] === section.key);
}

export function getOptionField(option: string, field: Field) {
  const meta = {...getOption(option), ...field};
  const Field = meta.component || TextField;
  return (
    <Field
      {...meta}
      name={option}
      key={option}
      defaultValue={getOptionDefault(option)}
      required={meta.required && !meta.allowEmpty}
      disabledReason={meta.disabledReason && disabledReasons[meta.disabledReason]}
    />
  );
}

function getSectionFieldSet(section: Section, fields: Field[]) {
  return (
    <fieldset key={section.key}>
      {section.heading && <legend>{section.heading}</legend>}
      {fields}
    </fieldset>
  );
}

export function getForm(fieldMap: Record<string, Field>) {
  const sets: React.ReactNode[] = [];

  for (const section of sections) {
    const set: Field[] = [];

    for (const option of optionsForSection(section)) {
      if (fieldMap[option.key]) {
        set.push(fieldMap[option.key]);
      }
    }

    if (set.length) {
      sets.push(getSectionFieldSet(section, set));
    }
  }

  return sets;
}
