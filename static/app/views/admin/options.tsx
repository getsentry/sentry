import keyBy from 'lodash/keyBy';

import BooleanField from 'sentry/components/forms/fields/booleanField';
import EmailField from 'sentry/components/forms/fields/emailField';
import NumberField from 'sentry/components/forms/fields/numberField';
import RadioField from 'sentry/components/forms/fields/radioField';
import TextField from 'sentry/components/forms/fields/textField';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';

type Section = {
  key: string;
  heading?: string;
};

// TODO(epurkhiser): This should really use the types from the form system, but
// they're still pretty bad so that's difficult I guess?
export type Field = {
  key: string;
  label: React.ReactNode;
  allowEmpty?: boolean;
  choices?: [value: string, label: string][];
  component?: React.ComponentType<any>;
  defaultValue?: () => string | number | false;
  disabled?: boolean;
  disabledReason?: string;
  help?: React.ReactNode;
  isSet?: boolean;
  max?: number;
  min?: number;
  placeholder?: string;
  required?: boolean;
  step?: number;
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

const HIGH_THROUGHPUT_RATE_OPTION = {
  defaultValue: () => '0',
  component: NumberField,
  min: 0.0,
  max: 1.0,
  step: 0.0001,
};

const performanceOptionDefinitions: Field[] = [
  {
    key: 'performance.issues.all.problem-detection',
    label: t('Performance problem detection rate'),
    help: t(
      'Controls the rate at which performance problems are detected across the entire system. A value of 0 will disable performance issue detection, and a value of 1.0 turns on detection for every ingested transaction.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.all.problem-creation',
    label: t('Performance problem creation rate'),
    help: t(
      'Controls the rate at which performance issues are created across the entire system. A value of 0 will disable performance issue detection, and a value of 1.0 turns on creation for every detected performance problem.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.all.early-adopter-rollout',
    label: t('Performance issues creation EA Rollout'),
    help: t(
      'Controls the rate at which performance issues are created for EA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.all.general-availability-rollout',
    label: t('Performance issues creation GA Rollout'),
    help: t(
      'Controls the rate at which performance issues are created for all organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.all.post-process-group-early-adopter-rollout',
    label: t('Performance issues post process group EA Rollout'),
    help: t(
      'Controls the rate at which performance issues sent through post process group for EA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.all.post-process-group-ga-rollout',
    label: t('Performance issues post process group GA Rollout'),
    help: t(
      'Controls the rate at which performance issues sent through post process group for all organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.n_plus_one.problem-detection',
    label: t('N+1 detection rate'),
    help: t(
      'Controls the rate at which performance problems are detected specifically for N+1 detection. Value of 0 will disable detection, a value of 1.0 fully enables it.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.n_plus_one.problem-creation',
    label: t('N+1 creation rate'),
    help: t(
      'Controls the rate at which performance issues are created specifically for N+1 detection. Value of 0 will disable creation, a value of 1.0 fully enables it.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.n_plus_one_db.problem-detection',
    label: t('N+1 (DB) detection rate'),
    help: t(
      'Controls the rate at which performance problems are detected specifically for N+1 detection. Value of 0 will disable detection, a value of 1.0 fully enables it.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.n_plus_one_db.problem-creation',
    label: t('N+1 (DB) creation rate'),
    help: t(
      'Controls the rate at which performance issues are created specifically for N+1 detection. Value of 0 will disable creation, a value of 1.0 fully enables it.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.n_plus_one_db_ext.problem-creation',
    label: t('N+1 (DB) (Extended) creation rate'),
    help: t(
      'Controls the rate at which performance issues are created specifically for N+1 detection (extended). Value of 0 will disable creation, a value of 1.0 fully enables it.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.n_plus_one_db.count_threshold',
    label: t('N+1 (DB) count threshold'),
    help: t(
      'Detector threshold. Controls the number of spans required to trigger performance issues. This affects all organizations system-wide.'
    ),
    defaultValue: () => '5',
    component: NumberField,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    step: 1,
  },
  {
    key: 'performance.issues.n_plus_one_db.duration_threshold', // TODO: For fixing typo later.
    label: t('N+1 (DB) duration threshold'),
    help: t(
      'Detector threshold. Controls the threshold for the cumulative duration of involved spans required to trigger performance issues. This affects all organizations system-wide.'
    ),
    defaultValue: () => '100',
    component: NumberField,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    step: 1,
  },
  {
    key: 'performance.issues.consecutive_db.problem-creation',
    label: t('Problem Creation Rate'),
    help: t(
      'Controls the overall rate at which performance problems are detected by the Consecutive DB detector.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.consecutive_db.la-rollout',
    label: t('Limited Availability Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the Consecutive DB detector for LA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.consecutive_db.ea-rollout',
    label: t('Early Adopter Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the Consecutive DB detector for EA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.consecutive_db.ga-rollout',
    label: t('General Availability Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the Consecutive DB detector for GA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.n_plus_one_api_calls.problem-creation',
    label: t('Problem Creation Rate'),
    help: t(
      'Controls the overall rate at which performance problems are detected by the N+1 API Calls detector.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.n_plus_one_api_calls.la-rollout',
    label: t('Limited Availability Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the N+1 API Calls detector for LA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.n_plus_one_api_calls.ea-rollout',
    label: t('Early Adopter Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the N+1 API Calls detector for EA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.n_plus_one_api_calls.ga-rollout',
    label: t('General Availability Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the for N+1 API Calls detector for GA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.compressed_assets.problem-creation',
    label: t('Problem Creation Rate'),
    help: t(
      'Controls the overall rate at which performance problems are detected by the compressed assets detector.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.compressed_assets.la-rollout',
    label: t('Limited Availability Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the compressed assets detector for LA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.compressed_assets.ea-rollout',
    label: t('Early Adopter Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the compressed assets detector for EA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.compressed_assets.ga-rollout',
    label: t('General Availability Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the compressed assets detector for GA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.file_io_main_thread.problem-creation',
    label: t('File IO Problem Creation Rate'),
    help: t(
      'Controls the overall rate at which performance problems are detected by the File IO Detector'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.slow_db_query.problem-creation',
    label: t('Problem Creation Rate'),
    help: t(
      'Controls the overall rate at which performance problems are detected by the slow DB span detector.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.slow_db_query.la-rollout',
    label: t('Limited Availability Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the slow DB span detector for LA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.slow_db_query.ea-rollout',
    label: t('Early Adopter Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the slow DB span detector for EA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.slow_db_query.ga-rollout',
    label: t('General Availability Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the slow DB span detector for GA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.m_n_plus_one_db.problem-creation',
    label: t('Problem Creation Rate'),
    help: t(
      'Controls the overall rate at which performance problems are detected by the MN+1 DB detector.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.m_n_plus_one_db.la-rollout',
    label: t('Limited Availability Detection Rate'),
    help: t(
      'Controls the % of orgs in which performance problems are detected by the MN+1 DB detector for LA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.m_n_plus_one_db.ea-rollout',
    label: t('Early Adopter Detection Rate'),
    help: t(
      'Controls the % of orgs in which performance problems are detected by the MN+1 DB detector for EA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.m_n_plus_one_db.ga-rollout',
    label: t('General Availability Detection Rate'),
    help: t(
      'Controls the % of orgs in which performance problems are detected by the MN+1 DB detector for GA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'performance.issues.render_blocking_assets.problem-creation',
    label: t('Problem Creation Rate'),
    help: t(
      'Controls the overall rate at which performance problems are detected by the large render blocking asset detector.'
    ),
  },
  {
    key: 'performance.issues.render_blocking_assets.la-rollout',
    label: t('Limited Availability Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the large render blocking asset detector for LA organizations.'
    ),
  },
  {
    key: 'performance.issues.render_blocking_assets.ea-rollout',
    label: t('Early Adopter Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the large render blocking asset detector for EA organizations.'
    ),
  },
  {
    key: 'performance.issues.render_blocking_assets.ga-rollout',
    label: t('General Availability Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the large render blocking asset detector for GA organizations.'
    ),
  },
  {
    key: 'performance.issues.consecutive_http.max_duration_between_spans',
    label: t('Time Between Spans'),
    help: t(
      'Maximum time, in ms, between consecutive HTTP spans to be considered part of the same problem.'
    ),
    defaultValue: () => '1000',
    component: NumberField,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    step: 1,
  },
  {
    key: 'performance.issues.consecutive_http.consecutive_count_threshold',
    label: t('Consecutive Count Threshold'),
    help: t('The minimum number of offending spans that must occur consecutively.'),
    defaultValue: () => '3',
    component: NumberField,
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
    step: 1,
  },
  {
    key: 'performance.issues.consecutive_http.span_duration_threshold',
    label: t('Span Duration Threshold'),
    help: t(
      'The duration, in ms, that a span must exceed for it to be considered an offending span.'
    ),
    defaultValue: () => '1000',
    component: NumberField,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    step: 1,
  },
  {
    key: 'performance.issues.large_http_payload.size_threshold',
    label: t('Payload Size Threshold'),
    help: t(
      'The threshold at which the payload size of an HTTP span is considered to be too large, in bytes.'
    ),
    defaultValue: () => '1000000',
    component: NumberField,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    step: 1,
  },
  {
    key: 'profile.issues.blocked_main_thread-ingest.la-rollout',
    label: t('Limited Availability Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the blocked main thread profiling detector for LA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'profile.issues.blocked_main_thread-ingest.ea-rollout',
    label: t('Early Adopter Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the blocked main thread profiling detector for EA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'profile.issues.blocked_main_thread-ingest.ga-rollout',
    label: t('General Availability Detection Rate'),
    help: t(
      'Controls the rate at which performance problems are detected by the blocked main thread profiling detector for GA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'profile.issues.blocked_main_thread-ppg.la-rollout',
    label: t('Limited Availability Detection Rate'),
    help: t(
      'Controls the rate at which profile blocked main thread performance problems are sent to post process group for LA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'profile.issues.blocked_main_thread-ppg.ea-rollout',
    label: t('Early Adopter Detection Rate'),
    help: t(
      'Controls the rate at which profile blocked main thread performance problems are sent to post process group for EA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
  },
  {
    key: 'profile.issues.blocked_main_thread-ppg.ga-rollout',
    label: t('General Availability Detection Rate'),
    help: t(
      'Controls the rate at which profile blocked main thread performance problems are sent to post process group for GA organizations.'
    ),
    ...HIGH_THROUGHPUT_RATE_OPTION,
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
    label: t('Organization Creation Rate Limit'),
    placeholder: 'e.g. 5',
    help: t(
      'The maximum number of organizations which may be created by a single account in a one hour window.'
    ),
  },
  {
    key: 'beacon.anonymous',
    label: 'Usage Statistics',
    component: RadioField,
    // yes and no are inverted here due to the nature of this configuration
    choices: [
      ['false', t('Send my contact information along with usage statistics')],
      ['true', t('Please keep my usage information anonymous')],
    ],
    help: tct(
      'If enabled, any stats reported to sentry.io will exclude identifying information (such as your administrative email address). By anonymizing your installation the Sentry team will be unable to contact you about security updates. For more information on what data is sent to Sentry, see the [link:documentation]. Note: This is separate from error-reporting for the self-hosted installer. The data reported to the beacon only includes usage stats from your running self-hosted instance.',
      {
        link: <ExternalLink href="https://develop.sentry.dev/self-hosted/" />,
      }
    ),
  },
  {
    key: 'beacon.record_cpu_ram_usage',
    label: 'RAM/CPU usage',
    component: RadioField,
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
  ...performanceOptionDefinitions,
];

const definitionsMap = keyBy(definitions, def => def.key);

const disabledReasons = {
  diskPriority:
    'This setting is defined in config.yml and may not be changed via the web UI.',
  smtpDisabled: 'SMTP mail has been disabled, so this option is unavailable',
};

export function getOption(option: string): Field {
  return definitionsMap[option]!;
}

export function getOptionDefault(option: string): string | number | false | undefined {
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

function getSectionFieldSet(section: Section, fields: React.ReactNode[]) {
  return (
    <fieldset key={section.key}>
      {section.heading && <legend>{section.heading}</legend>}
      {fields}
    </fieldset>
  );
}

export function getForm(fieldMap: Record<string, React.ReactNode>) {
  const sets: React.ReactNode[] = [];

  for (const section of sections) {
    const set: React.ReactNode[] = [];

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
