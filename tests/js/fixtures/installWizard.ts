import type {InstallWizardOptions} from 'sentry/views/admin/installWizard/index';

export function InstallWizardFixture(
  params: Partial<InstallWizardOptions> = {}
): InstallWizardOptions {
  return {
    'mail.use-tls': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
      },
    },
    'mail.use-ssl': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
      },
    },
    'mail.username': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
      },
    },
    'mail.port': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: false,
        isSet: true,
      },
    },
    'system.admin-email': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: false,
        isSet: true,
      },
    },
    'mail.password': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
      },
    },
    'mail.from': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: false,
        isSet: true,
      },
    },
    'system.url-prefix': {
      field: {
        disabledReason: 'diskPriority',
        required: true,
        disabled: true,
        allowEmpty: false,
        isSet: true,
      },
    },
    'auth.allow-registration': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
      },
    },
    'beacon.anonymous': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: true,
        isSet: true,
      },
    },
    'mail.host': {
      field: {
        disabledReason: undefined,
        required: true,
        disabled: false,
        allowEmpty: false,
        isSet: true,
      },
    },
    ...params,
  };
}
