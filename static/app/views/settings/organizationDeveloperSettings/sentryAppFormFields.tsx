import {Tag} from '@sentry/scraps/badge';
import {withFieldGroup} from '@sentry/scraps/form';
import {ExternalLink} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export const NameField = withFieldGroup({
  defaultValues: {name: ''},
  render: ({group}) => (
    <group.AppField name="name">
      {field => (
        <field.Layout.Row
          label={t('Name')}
          hintText={t('Human readable name of your Integration.')}
          required
        >
          <field.Input
            value={field.state.value}
            onChange={field.handleChange}
            placeholder={t('e.g. My Integration')}
          />
        </field.Layout.Row>
      )}
    </group.AppField>
  ),
});

export const AuthorField = withFieldGroup({
  defaultValues: {author: ''},
  render: ({group}) => (
    <group.AppField name="author">
      {field => (
        <field.Layout.Row
          label={t('Author')}
          hintText={t('The company or person who built and maintains this Integration.')}
          required
        >
          <field.Input
            value={field.state.value}
            onChange={field.handleChange}
            placeholder={t('e.g. Acme Software')}
          />
        </field.Layout.Row>
      )}
    </group.AppField>
  ),
});

// Mirrors CLAUDE_ROUTINE_URL_RE in src/sentry/utils/sentry_apps/webhooks.py;
// payloads sent to matching URLs get a plain-text prompt added.
const CLAUDE_ROUTINE_URL_REGEX =
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

export const WebhookUrlField = withFieldGroup({
  defaultValues: {webhookUrl: ''},
  props: WEBHOOK_URL_DEFAULT_PROPS,
  render: function WebhookUrlFieldGroup({
    group,
    label,
    hint,
    placeholder,
    required,
    onValueChange,
  }) {
    const organization = useOrganization();

    return (
      <group.AppField
        name="webhookUrl"
        listeners={{
          onChange: ({value}: {value: string}) => onValueChange?.(value),
        }}
      >
        {field => (
          <field.Layout.Row label={label} hintText={hint} required={required}>
            <field.Input
              value={field.state.value}
              onChange={field.handleChange}
              placeholder={placeholder}
              trailingItems={
                organization.features.includes('sentry-apps-claude-routine-webhooks') &&
                CLAUDE_ROUTINE_URL_REGEX.test(field.state.value) ? (
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
      </group.AppField>
    );
  },
});

export const WebhookHeadersField = withFieldGroup({
  defaultValues: {webhookHeaders: ''},
  render: ({group}) => (
    <group.AppField name="webhookHeaders">
      {field => (
        <field.Layout.Row
          label={t('Webhook Headers')}
          hintText={t(
            'Custom headers to include with every webhook request. Only certain headers are allowed, such as Authorization or X-* custom headers. Enter one header per line in the format: Header-Name: value. Saved header values are masked.'
          )}
        >
          <field.TextArea
            autosize
            value={field.state.value}
            onChange={field.handleChange}
            placeholder={'Authorization: Bearer <token>\nX-Custom-Header: value'}
          />
        </field.Layout.Row>
      )}
    </group.AppField>
  ),
});

export const RedirectUrlField = withFieldGroup({
  defaultValues: {redirectUrl: ''},
  render: ({group}) => (
    <group.AppField name="redirectUrl">
      {field => (
        <field.Layout.Row
          label={t('Redirect URL')}
          hintText={t('The URL Sentry will redirect users to after installation.')}
        >
          <field.Input
            value={field.state.value}
            onChange={field.handleChange}
            placeholder={t('e.g. https://example.com/sentry/setup/')}
          />
        </field.Layout.Row>
      )}
    </group.AppField>
  ),
});

export const VerifyInstallField = withFieldGroup({
  defaultValues: {verifyInstall: false},
  render: ({group}) => (
    <group.AppField name="verifyInstall">
      {field => (
        <field.Layout.Row
          label={t('Verify Installation')}
          hintText={t(
            'If enabled, installations will need to be verified before becoming installed.'
          )}
        >
          <field.Switch checked={field.state.value} onChange={field.handleChange} />
        </field.Layout.Row>
      )}
    </group.AppField>
  ),
});

const ALERTABLE_DEFAULT_PROPS: {requireWebhookUrl?: boolean} = {};

export const AlertableField = withFieldGroup({
  defaultValues: {isAlertable: false, webhookUrl: ''},
  props: ALERTABLE_DEFAULT_PROPS,
  render: ({group, requireWebhookUrl}) => (
    <group.AppField name="isAlertable">
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
          <group.Subscribe
            selector={state => Boolean(requireWebhookUrl) && !state.values.webhookUrl}
          >
            {webhookDisabled => (
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={
                  webhookDisabled
                    ? t('Cannot enable alert action without a webhook url')
                    : false
                }
              />
            )}
          </group.Subscribe>
        </field.Layout.Row>
      )}
    </group.AppField>
  ),
});

export const SchemaField = withFieldGroup({
  defaultValues: {schema: ''},
  render: ({group}) => (
    <group.AppField name="schema">
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
          <field.TextArea
            autosize
            value={field.state.value}
            onChange={field.handleChange}
          />
        </field.Layout.Row>
      )}
    </group.AppField>
  ),
});

export const OverviewField = withFieldGroup({
  defaultValues: {overview: ''},
  render: ({group}) => (
    <group.AppField name="overview">
      {field => (
        <field.Layout.Row
          label={t('Overview')}
          hintText={t('Description of your Integration and its functionality.')}
        >
          <field.TextArea
            autosize
            value={field.state.value}
            onChange={field.handleChange}
          />
        </field.Layout.Row>
      )}
    </group.AppField>
  ),
});

export const AllowedOriginsField = withFieldGroup({
  defaultValues: {allowedOrigins: ''},
  render: ({group}) => (
    <group.AppField name="allowedOrigins">
      {field => (
        <field.Layout.Row
          label={t('Authorized JavaScript Origins')}
          hintText={t('Separate multiple entries with a newline.')}
        >
          <field.TextArea
            autosize
            value={field.state.value}
            onChange={field.handleChange}
            placeholder={t('e.g. example.com')}
          />
        </field.Layout.Row>
      )}
    </group.AppField>
  ),
});
