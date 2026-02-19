import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {
  AutoSaveField,
  defaultFormOptions,
  FieldGroup,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {AuthProvider} from 'sentry/types/auth';
import type {Organization} from 'sentry/types/organization';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  formatStoreCrashReports,
  getStoreCrashReportsValues,
  SettingScope,
} from 'sentry/utils/crashReports';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {DataScrubbing} from 'sentry/views/settings/components/dataScrubbing';
import DataSecrecy from 'sentry/views/settings/components/dataSecrecy/index';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

const orgSecuritySchema = z.object({
  require2FA: z.boolean(),
  allowSharedIssues: z.boolean(),
  enhancedPrivacy: z.boolean(),
  scrapeJavaScript: z.boolean(),
  allowJoinRequests: z.boolean(),
  dataScrubber: z.boolean(),
  dataScrubberDefaults: z.boolean(),
  scrubIPAddresses: z.boolean(),
});

type OrgSecurityData = Partial<z.infer<typeof orgSecuritySchema>>;

const storeCrashReportsSchema = z.object({
  storeCrashReports: z.string(),
});

const sensitiveFieldsSchema = z.object({
  sensitiveFields: z.string(),
});

const safeFieldsSchema = z.object({
  safeFields: z.string(),
});

const STORE_CRASH_REPORTS_OPTIONS = getStoreCrashReportsValues(
  SettingScope.ORGANIZATION
).map(value => ({
  value: String(value),
  label: formatStoreCrashReports(value) as string,
}));

function SensitiveFieldsForm({
  organization,
  disabled,
}: {
  disabled: boolean;
  organization: Organization;
}) {
  const sensitiveFieldsMutationFn = (data: {sensitiveFields: string}) => {
    return fetchMutation<Organization>({
      method: 'PUT',
      url: `/organizations/${organization.slug}/`,
      data: {sensitiveFields: extractMultilineFields(data.sensitiveFields)},
    });
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      sensitiveFields: convertMultilineFieldValue(organization.sensitiveFields),
    },
    validators: {onDynamic: sensitiveFieldsSchema},
    onSubmit: ({value}) =>
      sensitiveFieldsMutationFn(value).then(data => {
        updateOrganization(data);
        addSuccessMessage(
          t('Changes to your scrubbing configuration will apply to all new events.')
        );
      }),
  });

  return (
    <form.AppForm>
      <form.FormWrapper>
        <form.AppField name="sensitiveFields">
          {field => (
            <field.Layout.Row
              label={t('Global Sensitive Fields')}
              hintText={t(
                'Additional field names to match against when scrubbing data for all projects. Separate multiple entries with a newline.'
              )}
            >
              <field.TextArea
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="e.g. email"
                rows={1}
                autosize
                maxRows={10}
                disabled={disabled}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <Text size="sm" variant="muted">
          {t('Note: These fields will be used in addition to project specific fields.')}
        </Text>
        <Flex gap="sm" justify="end">
          <Button size="sm" onClick={() => form.reset()}>
            {t('Cancel')}
          </Button>
          <form.SubmitButton size="sm">{t('Save')}</form.SubmitButton>
        </Flex>
      </form.FormWrapper>
    </form.AppForm>
  );
}

function SafeFieldsForm({
  organization,
  disabled,
}: {
  disabled: boolean;
  organization: Organization;
}) {
  const safeFieldsMutationFn = (data: {safeFields: string}) => {
    return fetchMutation<Organization>({
      method: 'PUT',
      url: `/organizations/${organization.slug}/`,
      data: {safeFields: extractMultilineFields(data.safeFields)},
    });
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      safeFields: convertMultilineFieldValue(organization.safeFields),
    },
    validators: {onDynamic: safeFieldsSchema},
    onSubmit: ({value}) =>
      safeFieldsMutationFn(value).then(data => {
        updateOrganization(data);
        addSuccessMessage(
          t('Changes to your scrubbing configuration will apply to all new events.')
        );
      }),
  });

  return (
    <form.AppForm>
      <form.FormWrapper>
        <form.AppField name="safeFields">
          {field => (
            <field.Layout.Row
              label={t('Global Safe Fields')}
              hintText={t(
                'Field names which data scrubbers should ignore. Separate multiple entries with a newline.'
              )}
            >
              <field.TextArea
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('e.g. business-email')}
                rows={1}
                autosize
                maxRows={10}
                disabled={disabled}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        <Text size="sm" variant="muted">
          {t('Note: These fields will be used in addition to project specific fields')}
        </Text>
        <Flex gap="sm" justify="end">
          <Button size="sm" onClick={() => form.reset()}>
            {t('Cancel')}
          </Button>
          <form.SubmitButton size="sm">{t('Save')}</form.SubmitButton>
        </Flex>
      </form.FormWrapper>
    </form.AppForm>
  );
}

export default function OrganizationSecurityAndPrivacyContent() {
  const organization = useOrganization();

  const {data: authProvider} = useApiQuery<AuthProvider>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/auth-provider/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {staleTime: 0}
  );

  const endpoint = `/organizations/${organization.slug}/`;
  const relayPiiConfig = organization.relayPiiConfig;
  const title = t('Security & Privacy');
  const disabled = !organization.access.includes('org:write');
  const hasSsoEnabled = !!authProvider;

  function handleUpdateOrganization(data: Organization) {
    updateOrganization(data);
  }

  const orgMutationOptions = mutationOptions({
    mutationFn: (data: OrgSecurityData) => {
      return fetchMutation<Organization>({
        method: 'PUT',
        url: endpoint,
        data,
      });
    },
    onSuccess: data => {
      handleUpdateOrganization(data);
    },
  });

  const storeCrashReportsMutationOptions = mutationOptions({
    mutationFn: (data: {storeCrashReports: string}) => {
      return fetchMutation<Organization>({
        method: 'PUT',
        url: endpoint,
        data: {storeCrashReports: Number(data.storeCrashReports)},
      });
    },
    onSuccess: data => {
      handleUpdateOrganization(data);
    },
  });

  const {isSelfHosted} = ConfigStore.getState();
  const showDataSecrecySettings =
    organization.features.includes('data-secrecy') && !isSelfHosted;

  return (
    <div data-test-id="organization-settings-security-and-privacy">
      <SentryDocumentTitle title={title} orgSlug={organization.slug} />
      <SettingsPageHeader title={title} />

      <FieldGroup title={t('Security & Privacy')}>
        <AutoSaveField
          name="require2FA"
          schema={orgSecuritySchema}
          initialValue={organization.require2FA}
          mutationOptions={orgMutationOptions}
          confirm={value =>
            value
              ? t(
                  'This will remove all members without two-factor authentication from your organization. It will also send them an email to setup 2FA and reinstate their access and settings. Do you want to continue?'
                )
              : t(
                  'Are you sure you want to allow users to access your organization without having two-factor authentication enabled?'
                )
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Require Two-Factor Authentication')}
              hintText={t(
                'Require and enforce two-factor authentication for all members'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={disabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="allowSharedIssues"
          schema={orgSecuritySchema}
          initialValue={organization.allowSharedIssues}
          mutationOptions={orgMutationOptions}
          confirm={value =>
            value
              ? t('Are you sure you want to allow sharing issues to anonymous users?')
              : undefined
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Allow Shared Issues')}
              hintText={t(
                'Enable sharing of limited details on issues to anonymous users'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={disabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="enhancedPrivacy"
          schema={orgSecuritySchema}
          initialValue={organization.enhancedPrivacy}
          mutationOptions={orgMutationOptions}
          confirm={value =>
            value
              ? undefined
              : t(
                  'Disabling this can have privacy implications for ALL projects, are you sure you want to continue?'
                )
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Enhanced Privacy')}
              hintText={t(
                'Enable enhanced privacy controls to limit personally identifiable information (PII) as well as source code in things like notifications'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={disabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="scrapeJavaScript"
          schema={orgSecuritySchema}
          initialValue={organization.scrapeJavaScript}
          mutationOptions={orgMutationOptions}
          confirm={value =>
            value
              ? undefined
              : t(
                  "Are you sure you want to disable sourcecode fetching for JavaScript events? This will affect Sentry's ability to aggregate issues if you're not already uploading sourcemaps as artifacts."
                )
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Allow JavaScript Source Fetching')}
              hintText={t(
                'Allow Sentry to scrape missing JavaScript source context when possible'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={disabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        {organization.features.includes('event-attachments') && (
          <AutoSaveField
            name="storeCrashReports"
            schema={storeCrashReportsSchema}
            initialValue={String(organization.storeCrashReports)}
            mutationOptions={storeCrashReportsMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Store Minidumps As Attachments')}
                hintText={t(
                  'Store minidumps as attachments for improved processing and download in issue details.'
                )}
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={STORE_CRASH_REPORTS_OPTIONS}
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </AutoSaveField>
        )}

        {!hasSsoEnabled && (
          <AutoSaveField
            name="allowJoinRequests"
            schema={orgSecuritySchema}
            initialValue={organization.allowJoinRequests}
            mutationOptions={orgMutationOptions}
            confirm={value =>
              value
                ? t(
                    'Are you sure you want to allow users to request to join your organization?'
                  )
                : undefined
            }
          >
            {field => (
              <field.Layout.Row
                label={t('Allow Join Requests')}
                hintText={t('Allow users to request to join your organization')}
              >
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={disabled}
                />
              </field.Layout.Row>
            )}
          </AutoSaveField>
        )}
      </FieldGroup>

      <FieldGroup title={t('Data Scrubbing')}>
        <AutoSaveField
          name="dataScrubber"
          schema={orgSecuritySchema}
          initialValue={organization.dataScrubber}
          mutationOptions={orgMutationOptions}
          confirm={value =>
            value
              ? undefined
              : t(
                  'Disabling this can have privacy implications for ALL projects, are you sure you want to continue?'
                )
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Require Data Scrubber')}
              hintText={t(
                'Require server-side data scrubbing be enabled for all projects'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={disabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="dataScrubberDefaults"
          schema={orgSecuritySchema}
          initialValue={organization.dataScrubberDefaults}
          mutationOptions={orgMutationOptions}
          confirm={value =>
            value
              ? undefined
              : t(
                  'Disabling this can have privacy implications for ALL projects, are you sure you want to continue?'
                )
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Require Using Default Scrubbers')}
              hintText={t(
                'Require the default scrubbers be applied to prevent things like passwords and credit cards from being stored for all projects'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={disabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <SensitiveFieldsForm organization={organization} disabled={disabled} />
        <SafeFieldsForm organization={organization} disabled={disabled} />

        <AutoSaveField
          name="scrubIPAddresses"
          schema={orgSecuritySchema}
          initialValue={organization.scrubIPAddresses}
          mutationOptions={orgMutationOptions}
          confirm={value =>
            value
              ? undefined
              : t(
                  'Disabling this can have privacy implications for ALL projects, are you sure you want to continue?'
                )
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Prevent Storing of IP Addresses')}
              hintText={t(
                'Preventing IP addresses from being stored for new events on all projects'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={disabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>
      </FieldGroup>

      {showDataSecrecySettings && <DataSecrecy />}

      <DataScrubbing
        additionalContext={t(
          'Advanced data scrubbing rules can be configured at the organization level and will apply to all projects. Project-level rules can be configured in addition to organization-level rules.'
        )}
        endpoint={endpoint}
        relayPiiConfig={relayPiiConfig}
        organization={organization}
        disabled={disabled}
        onSubmitSuccess={data => handleUpdateOrganization({...organization, ...data})}
      />
    </div>
  );
}
