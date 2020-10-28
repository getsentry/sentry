export function InstallWizard(params) {
  return {
    'mail.use-tls': {
      field: {
        disabledReason: null,
        default: false,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
      },
    },
    'mail.username': {
      field: {
        disabledReason: null,
        default: '',
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
      },
    },
    'mail.port': {
      field: {
        disabledReason: null,
        default: 25,
        required: true,
        disabled: false,
        allowEmpty: false,
        isSet: true,
      },
    },
    'system.admin-email': {
      field: {
        disabledReason: null,
        default: '',
        required: true,
        disabled: false,
        allowEmpty: false,
        isSet: true,
      },
    },
    'mail.password': {
      field: {
        disabledReason: null,
        default: '',
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
      },
    },
    'mail.from': {
      field: {
        disabledReason: null,
        default: 'root@localhost',
        required: true,
        disabled: false,
        allowEmpty: false,
        isSet: true,
      },
    },
    'system.url-prefix': {
      field: {
        disabledReason: 'diskPriority',
        default: '',
        required: true,
        disabled: true,
        allowEmpty: false,
        isSet: true,
      },
    },
    'auth.allow-registration': {
      field: {
        disabledReason: null,
        default: false,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
      },
    },
    'beacon.anonymous': {
      field: {
        disabledReason: null,
        default: false,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
      },
    },
    'mail.host': {
      field: {
        disabledReason: null,
        default: 'localhost',
        required: true,
        disabled: false,
        allowEmpty: false,
        isSet: true,
      },
    },
    ...params,
  };
}
