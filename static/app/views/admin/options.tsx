import keyBy from 'lodash/keyBy';

import {ExternalLink} from '@sentry/scraps/link';

import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';

type Section = {key: string; heading?: string};

export type OptionValue = string | boolean;

/**
 * Field metadata the `/internal/options/` endpoint returns for each option.
 */
export type OptionFieldMeta = {
  allowEmpty: boolean;
  disabled: boolean;
  isSet: boolean;
  required: boolean;
  disabledReason?: string | null;
};

type BaseOptionDefinition = {
  key: string;
  label: React.ReactNode;
  help?: React.ReactNode;
  placeholder?: string;
};

export type OptionDefinition =
  | (BaseOptionDefinition & {type: 'text' | 'email'; defaultValue?: () => string})
  | (BaseOptionDefinition & {defaultValue: () => boolean; type: 'boolean'})
  | (BaseOptionDefinition & {
      choices: Array<[value: string, label: string]>;
      type: 'radio';
      defaultValue?: () => string;
    });

// This are ordered based on their display order visually
export const sections: Section[] = [
  {key: 'system'},
  {key: 'mail', heading: t('Outbound email')},
  {key: 'auth', heading: t('Authentication')},
  {key: 'beacon', heading: t('Beacon')},
];

// This are ordered based on their display order visually
const definitions: OptionDefinition[] = [
  {
    key: 'system.url-prefix',
    type: 'text',
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
    type: 'email',
    defaultValue: () => ConfigStore.get('user').email,
  },
  {
    key: 'system.support-email',
    label: t('Support Email'),
    placeholder: 'support@example.com',
    help: t('The support contact for this Sentry installation.'),
    type: 'email',
    defaultValue: () => ConfigStore.get('user').email,
  },
  {
    key: 'system.security-email',
    label: t('Security Email'),
    placeholder: 'security@example.com',
    help: t('The security contact for this Sentry installation.'),
    type: 'email',
    defaultValue: () => ConfigStore.get('user').email,
  },
  {
    key: 'auth.allow-registration',
    label: t('Allow Registration'),
    help: t('Allow anyone to create an account and access this Sentry installation.'),
    type: 'boolean',
    defaultValue: () => false,
  },
  {
    key: 'auth.ip-rate-limit',
    type: 'text',
    label: t('IP Rate Limit'),
    placeholder: 'e.g. 10',
    help: t(
      'The maximum number of times an authentication attempt may be made by a single IP address in a 60 second window.'
    ),
  },
  {
    key: 'auth.user-rate-limit',
    type: 'text',
    label: t('User Rate Limit'),
    placeholder: 'e.g. 10',
    help: t(
      'The maximum number of times an authentication attempt may be made against a single account in a 60 second window.'
    ),
  },
  {
    key: 'api.rate-limit.org-create',
    type: 'text',
    label: t('Organization Creation Rate Limit'),
    placeholder: 'e.g. 5',
    help: t(
      'The maximum number of organizations which may be created by a single account in a one hour window.'
    ),
  },
  {
    key: 'beacon.anonymous',
    label: 'Usage Statistics',
    type: 'radio',
    // yes and no are inverted here due to the nature of this configuration
    choices: [
      ['false', t('Send my contact information along with usage statistics')],
      ['true', t('Please keep my usage information anonymous')],
    ],
    help: tct(
      'If enabled, any stats reported to sentry.io will exclude identifying information (such as your administrative email address). By anonymizing your installation the Sentry team will be unable to contact you about security updates. For more information on what data is sent to Sentry, see the [link:documentation]. Note: This is separate from error-reporting for the self-hosted installer. The data reported to the beacon only includes usage stats from your running self-hosted instance.',
      {link: <ExternalLink href="https://develop.sentry.dev/self-hosted/" />}
    ),
  },
  {
    key: 'beacon.record_cpu_ram_usage',
    label: 'RAM/CPU usage',
    type: 'radio',
    defaultValue: () => 'true',
    choices: [
      [
        'true',
        t(
          'Yes, I would love to help Sentry developers improve the experience of self-hosted by sending CPU/RAM usage'
        ),
      ],
      ['false', t('No, I would prefer to keep CPU/RAM usage private')],
    ],
    help: tct(
      `Recording CPU/RAM usage will greatly help our development team understand how self-hosted sentry
      is being typically used, and to keep track of improvements that we hope to bring you in the future.`,
      {link: <ExternalLink href="https://sentry.io/privacy/" />}
    ),
  },
  {
    key: 'mail.from',
    label: t('Email From'),
    type: 'email',
    defaultValue: () => `sentry@${document.location.hostname}`,
    help: t('Email address to be used in From for all outbound email.'),
  },
  {
    key: 'mail.host',
    type: 'text',
    label: t('SMTP Host'),
    placeholder: 'localhost',
    defaultValue: () => 'localhost',
  },
  {
    key: 'mail.port',
    type: 'text',
    label: t('SMTP Port'),
    placeholder: '25',
    defaultValue: () => '25',
  },
  {key: 'mail.username', type: 'text', label: t('SMTP Username'), defaultValue: () => ''},
  {
    key: 'mail.password',
    type: 'text',
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
    type: 'boolean',
    defaultValue: () => false,
  },
  {
    key: 'mail.use-ssl',
    label: t('Use SSL? (exclusive with STARTTLS)'),
    type: 'boolean',
    defaultValue: () => false,
  },
];

const definitionsMap = keyBy(definitions, def => def.key);

export function getOption(option: string): OptionDefinition {
  return definitionsMap[option]!;
}

export function optionsForSection(section: Section) {
  return definitions.filter(option => option.key.split('.')[0] === section.key);
}
