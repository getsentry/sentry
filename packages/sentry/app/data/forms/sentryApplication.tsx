import {Field} from 'sentry/components/forms/type';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {extractMultilineFields} from 'sentry/utils';

const getPublicFormFields = (): Field[] => [
  {
    name: 'name',
    type: 'string',
    required: true,
    placeholder: 'e.g. My Integration',
    label: 'Name',
    help: 'Human readable name of your Integration.',
  },
  {
    name: 'author',
    type: 'string',
    required: true,
    placeholder: 'e.g. Acme Software',
    label: 'Author',
    help: 'The company or person who built and maintains this Integration.',
  },
  {
    name: 'webhookUrl',
    type: 'string',
    required: true,
    label: 'Webhook URL',
    placeholder: 'e.g. https://example.com/sentry/webhook/',
    help: tct(
      'All webhook requests for your integration will be sent to this URL. Visit the [webhook_docs:documentation] to see the different types and payloads.',
      {
        webhook_docs: (
          <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/webhooks/" />
        ),
      }
    ),
  },
  {
    name: 'redirectUrl',
    type: 'string',
    label: 'Redirect URL',
    placeholder: 'e.g. https://example.com/sentry/setup/',
    help: 'The URL Sentry will redirect users to after installation.',
  },
  {
    name: 'verifyInstall',
    label: 'Verify Installation',
    type: 'boolean',
    help: 'If enabled, installations will need to be verified before becoming installed.',
  },
  {
    name: 'isAlertable',
    type: 'boolean',
    label: 'Alert Rule Action',
    disabled: ({webhookDisabled}) => webhookDisabled,
    disabledReason: 'Cannot enable alert rule action without a webhook url',
    help: tct(
      'If enabled, this integration will be available in Issue Alert rules and Metric Alert rules in Sentry. The notification destination is the Webhook URL specified above. More on actions [learn_more:here].',
      {
        learn_more: (
          <ExternalLink href="https://docs.sentry.io/product/alerts-notifications/notifications/" />
        ),
      }
    ),
  },
  {
    name: 'schema',
    type: 'textarea',
    label: 'Schema',
    autosize: true,
    rows: 1,
    help: tct(
      'Schema for your UI components. Click [schema_docs:here] for documentation.',
      {
        schema_docs: (
          <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/ui-components/" />
        ),
      }
    ),
    getValue: (val: string) => (val === '' ? {} : JSON.parse(val)),
    setValue: (val: string) => {
      const schema = JSON.stringify(val, null, 2);
      if (schema === '{}') {
        return '';
      }
      return schema;
    },
    validate: ({id, form}) => {
      if (!form.schema) {
        return [];
      }

      try {
        JSON.parse(form.schema);
      } catch (e) {
        return [[id, 'Invalid JSON']];
      }
      return [];
    },
  },
  {
    name: 'overview',
    type: 'textarea',
    label: 'Overview',
    autosize: true,
    rows: 1,
    help: 'Description of your Integration and its functionality.',
  },
  {
    name: 'allowedOrigins',
    type: 'string',
    multiline: true,
    placeholder: 'e.g. example.com',
    label: 'Authorized JavaScript Origins',
    help: 'Separate multiple entries with a newline.',
    getValue: (val: string) => extractMultilineFields(val),
    setValue: (val: string[] | undefined | null) =>
      (val && typeof val.join === 'function' && val.join('\n')) || '',
  },
];

export const publicIntegrationForms = [
  {
    title: 'Public Integration Details',
    fields: getPublicFormFields(),
  },
];

const getInternalFormFields = () => {
  // Generate internal form fields copy copying the public form fields and
  // making adjustments:
  //
  //   1. remove fields not needed for internal integrations
  //   2. make webhookUrl optional

  const internalFormFields = getPublicFormFields().filter(
    formField =>
      !['redirectUrl', 'verifyInstall', 'author'].includes(formField.name || '')
  );
  const webhookField = internalFormFields.find(field => field.name === 'webhookUrl');
  if (webhookField) {
    webhookField.required = false;
  }
  return internalFormFields;
};

export const internalIntegrationForms = [
  {
    title: 'Internal Integration Details',
    fields: getInternalFormFields(),
  },
];
