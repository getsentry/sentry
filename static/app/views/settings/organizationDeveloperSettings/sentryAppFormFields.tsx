import {Tag} from '@sentry/scraps/badge';
import {defineAppFieldGroup} from '@sentry/scraps/form';
import {ExternalLink} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

const nameFieldGroup = defineAppFieldGroup(({strict}) => ({name: strict<string>()}));

function NameFieldImpl({fields}: {fields: typeof nameFieldGroup.fields}) {
  return (
    <fields.Field name="name">
      {field => (
        <field.Layout.Row
          label={t('Name')}
          hintText={t('Human readable name of your Integration.')}
          required
        >
          <field.Input
            value={field.value}
            onChange={field.handleChange}
            placeholder={t('e.g. My Integration')}
          />
        </field.Layout.Row>
      )}
    </fields.Field>
  );
}

export const NameField = nameFieldGroup.bindComponent(NameFieldImpl, 'fields');

const authorFieldGroup = defineAppFieldGroup(({strict}) => ({author: strict<string>()}));

function AuthorFieldImpl({fields}: {fields: typeof authorFieldGroup.fields}) {
  return (
    <fields.Field name="author">
      {field => (
        <field.Layout.Row
          label={t('Author')}
          hintText={t('The company or person who built and maintains this Integration.')}
          required
        >
          <field.Input
            value={field.value}
            onChange={field.handleChange}
            placeholder={t('e.g. Acme Software')}
          />
        </field.Layout.Row>
      )}
    </fields.Field>
  );
}

export const AuthorField = authorFieldGroup.bindComponent(AuthorFieldImpl, 'fields');

// Mirrors CLAUDE_ROUTINE_URL_RE in src/sentry/utils/sentry_apps/webhooks.py;
// payloads sent to matching URLs get a plain-text prompt added.
export const CLAUDE_ROUTINE_URL_REGEX =
  /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[^/?#]+\/fire\/?$/;

const WEBHOOK_URL_DEFAULT_PROPS: {
  hint?: React.ReactNode;
  label?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
} = {
  label: t('Webhook URL'),
  hint: tct(
    'All webhook requests for your integration will be sent to this URL. Visit the [webhookDocs:documentation] to see the different types and payloads.',
    {
      webhookDocs: (
        <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/webhooks/" />
      ),
    }
  ),
  placeholder: t('e.g. https://example.com/sentry/webhook/'),
};

const webhookUrlFieldGroup = defineAppFieldGroup(({strict}) => ({
  webhookUrl: strict<string>(),
}));

type WebhookUrlFieldProps = {
  fields: typeof webhookUrlFieldGroup.fields;
  hint?: React.ReactNode;
  label?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
};

function WebhookUrlFieldImpl({
  fields,
  label,
  hint,
  placeholder,
  required,
  onValueChange,
}: WebhookUrlFieldProps) {
  const organization = useOrganization();
  const fieldLabel = label ?? WEBHOOK_URL_DEFAULT_PROPS.label;
  const fieldHint = hint ?? WEBHOOK_URL_DEFAULT_PROPS.hint;
  const fieldPlaceholder = placeholder ?? WEBHOOK_URL_DEFAULT_PROPS.placeholder;

  return (
    <fields.Field
      name="webhookUrl"
      listeners={[
        {
          run: ({value}) => onValueChange?.(value),
          triggers: ['change'],
        },
      ]}
    >
      {field => (
        <field.Layout.Row label={fieldLabel} hintText={fieldHint} required={required}>
          <field.Input
            value={field.value}
            onChange={field.handleChange}
            placeholder={fieldPlaceholder}
            trailingItems={
              organization.features.includes('sentry-apps-claude-routine-webhooks') &&
              CLAUDE_ROUTINE_URL_REGEX.test(field.value) ? (
                <Tooltip
                  title={t(
                    'Sentry will automatically format your webhook payloads to be compatible with Claude Routines.'
                  )}
                >
                  <Tag variant="info">{t('Claude routine')}</Tag>
                </Tooltip>
              ) : null
            }
          />
        </field.Layout.Row>
      )}
    </fields.Field>
  );
}

export const WebhookUrlField = webhookUrlFieldGroup.bindComponent(
  WebhookUrlFieldImpl,
  'fields'
);

const webhookHeadersFieldGroup = defineAppFieldGroup(({strict}) => ({
  webhookHeaders: strict<string>(),
}));

function WebhookHeadersFieldImpl({
  fields,
}: {
  fields: typeof webhookHeadersFieldGroup.fields;
}) {
  return (
    <fields.Field name="webhookHeaders">
      {field => (
        <field.Layout.Row
          label={t('Webhook Headers')}
          hintText={t(
            'Custom headers to include with every webhook request. Only certain headers are allowed, such as Authorization or X-* custom headers. Enter one header per line in the format: Header-Name: value. Saved header values are masked.'
          )}
        >
          <field.TextArea
            autosize
            value={field.value}
            onChange={field.handleChange}
            placeholder={'Authorization: Bearer <token>\nX-Custom-Header: value'}
          />
        </field.Layout.Row>
      )}
    </fields.Field>
  );
}

export const WebhookHeadersField = webhookHeadersFieldGroup.bindComponent(
  WebhookHeadersFieldImpl,
  'fields'
);

const redirectUrlFieldGroup = defineAppFieldGroup(({strict}) => ({
  redirectUrl: strict<string>(),
}));

function RedirectUrlFieldImpl({fields}: {fields: typeof redirectUrlFieldGroup.fields}) {
  return (
    <fields.Field name="redirectUrl">
      {field => (
        <field.Layout.Row
          label={t('Redirect URL')}
          hintText={t('The URL Sentry will redirect users to after installation.')}
        >
          <field.Input
            value={field.value}
            onChange={field.handleChange}
            placeholder={t('e.g. https://example.com/sentry/setup/')}
          />
        </field.Layout.Row>
      )}
    </fields.Field>
  );
}

export const RedirectUrlField = redirectUrlFieldGroup.bindComponent(
  RedirectUrlFieldImpl,
  'fields'
);

const verifyInstallFieldGroup = defineAppFieldGroup(({strict}) => ({
  verifyInstall: strict<boolean>(),
}));

function VerifyInstallFieldImpl({
  fields,
}: {
  fields: typeof verifyInstallFieldGroup.fields;
}) {
  return (
    <fields.Field name="verifyInstall">
      {field => (
        <field.Layout.Row
          label={t('Verify Installation')}
          hintText={t(
            'If enabled, installations will need to be verified before becoming installed.'
          )}
        >
          <field.Switch checked={field.value} onChange={field.handleChange} />
        </field.Layout.Row>
      )}
    </fields.Field>
  );
}

export const VerifyInstallField = verifyInstallFieldGroup.bindComponent(
  VerifyInstallFieldImpl,
  'fields'
);

const alertableFieldGroup = defineAppFieldGroup(({strict}) => ({
  isAlertable: strict<boolean>(),
  webhookUrl: strict<string>(),
}));

function AlertableFieldImpl({
  fields,
  requireWebhookUrl,
}: {
  fields: typeof alertableFieldGroup.fields;
  requireWebhookUrl?: boolean;
}) {
  return (
    <fields.Field name="isAlertable">
      {field => (
        <field.Layout.Row
          label={t('Alert Action')}
          hintText={tct(
            'If enabled, this integration will be available as an action in alerts in Sentry. The notification destination is the Webhook URL specified above. More on actions [learnMore:here].',
            {
              learnMore: (
                <ExternalLink href="https://docs.sentry.io/product/alerts-notifications/notifications/" />
              ),
            }
          )}
        >
          <fields.Subscribe
            selector={state =>
              Boolean(requireWebhookUrl) &&
              !(state.values as {webhookUrl?: string}).webhookUrl
            }
          >
            {webhookDisabled => (
              <field.Switch
                checked={field.value}
                onChange={field.handleChange}
                disabled={
                  webhookDisabled
                    ? t('Cannot enable alert action without a webhook url')
                    : false
                }
              />
            )}
          </fields.Subscribe>
        </field.Layout.Row>
      )}
    </fields.Field>
  );
}

export const AlertableField = alertableFieldGroup.bindComponent(
  AlertableFieldImpl,
  'fields'
);

const schemaFieldGroup = defineAppFieldGroup(({strict}) => ({schema: strict<string>()}));

function SchemaFieldImpl({fields}: {fields: typeof schemaFieldGroup.fields}) {
  return (
    <fields.Field name="schema">
      {field => (
        <field.Layout.Row
          label={t('Schema')}
          hintText={tct(
            'Schema for your UI components. Click [schemaDocs:here] for documentation.',
            {
              schemaDocs: (
                <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/ui-components/" />
              ),
            }
          )}
        >
          <field.TextArea autosize value={field.value} onChange={field.handleChange} />
        </field.Layout.Row>
      )}
    </fields.Field>
  );
}

export const SchemaField = schemaFieldGroup.bindComponent(SchemaFieldImpl, 'fields');

const overviewFieldGroup = defineAppFieldGroup(({strict}) => ({
  overview: strict<string>(),
}));

function OverviewFieldImpl({fields}: {fields: typeof overviewFieldGroup.fields}) {
  return (
    <fields.Field name="overview">
      {field => (
        <field.Layout.Row
          label={t('Overview')}
          hintText={t('Description of your Integration and its functionality.')}
        >
          <field.TextArea autosize value={field.value} onChange={field.handleChange} />
        </field.Layout.Row>
      )}
    </fields.Field>
  );
}

export const OverviewField = overviewFieldGroup.bindComponent(
  OverviewFieldImpl,
  'fields'
);

const allowedOriginsFieldGroup = defineAppFieldGroup(({strict}) => ({
  allowedOrigins: strict<string>(),
}));

function AllowedOriginsFieldImpl({
  fields,
}: {
  fields: typeof allowedOriginsFieldGroup.fields;
}) {
  return (
    <fields.Field name="allowedOrigins">
      {field => (
        <field.Layout.Row
          label={t('Authorized JavaScript Origins')}
          hintText={t('Separate multiple entries with a newline.')}
        >
          <field.TextArea
            autosize
            value={field.value}
            onChange={field.handleChange}
            placeholder={t('e.g. example.com')}
          />
        </field.Layout.Row>
      )}
    </fields.Field>
  );
}

export const AllowedOriginsField = allowedOriginsFieldGroup.bindComponent(
  AllowedOriginsFieldImpl,
  'fields'
);
