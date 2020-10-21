import keyBy from 'lodash/keyBy';

import ConfigStore from 'app/stores/configStore';
import {t, tct} from 'app/locale';
import {
  EmailField,
  TextField,
  BooleanField,
  RadioBooleanField,
} from 'app/components/forms';

// This are ordered based on their display order visually
const sections = [
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
        link: <a href="https://docs.sentry.io/server/beacon/" />,
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
    label: t('Use TLS?'),
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

export function getOption(option) {
  return definitionsMap[option];
}

export function getOptionDefault(option) {
  const meta = getOption(option);
  return meta.defaultValue ? meta.defaultValue() : undefined;
}

function optionsForSection(section) {
  return definitions.filter(option => option.key.split('.')[0] === section.key);
}

export function getOptionField(option, field) {
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
  const sets = [];
  for (const section of sections) {
    const set = [];
    for (const option of optionsForSection(section)) {
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
