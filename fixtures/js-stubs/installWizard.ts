import type {InstallWizardOptions} from 'sentry/views/admin/installWizard/index';

export function InstallWizard(params = {}): InstallWizardOptions {
  return {
    'mail.use-tls': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
        key: '',
        label: '',
      },
    },
    'mail.use-ssl': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
        key: '',
        label: '',
      },
    },
    'mail.username': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
        key: '',
        label: '',
      },
    },
    'mail.port': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: false,
        isSet: true,
        key: '',
        label: '',
      },
    },
    'system.admin-email': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: false,
        isSet: true,
        key: '',
        label: '',
      },
    },
    'mail.password': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
        key: '',
        label: '',
      },
    },
    'mail.from': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: false,
        isSet: true,
        key: '',
        label: '',
      },
    },
    'system.url-prefix': {
      field: {
        disabledReason: 'diskPriority',
        required: true,
        disabled: true,
        allowEmpty: false,
        isSet: true,
        key: '',
        label: '',
      },
    },
    'auth.allow-registration': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
        key: '',
        label: '',
      },
    },
    'beacon.anonymous': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
        key: '',
        label: '',
      },
    },
    'mail.host': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: false,
        isSet: true,
        key: '',
        label: '',
      },
    },
    ...params,
  };
}
