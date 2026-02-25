import {mutationOptions, useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {
  AutoSaveField,
  defaultFormOptions,
  FieldGroup,
  FormSearch,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
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

const securitySchema = z.object({
  require2FA: z.boolean(),
  allowSharedIssues: z.boolean(),
  enhancedPrivacy: z.boolean(),
  scrapeJavaScript: z.boolean(),
  storeCrashReports: z.number(),
  allowJoinRequests: z.boolean(),
});

const dataScrubBooleanSchema = z.object({
  dataScrubber: z.boolean(),
  dataScrubberDefaults: z.boolean(),
  scrubIPAddresses: z.boolean(),
});

const dataScrubMultilineSchema = z.object({
  sensitiveFields: z.string(),
  safeFields: z.string(),
});

function handleUpdateOrganization(data: Organization) {
  // This will update OrganizationStore (as well as OrganizationsStore
  // which is slightly incorrect because it has summaries vs a detailed org)
  updateOrganization(data);
}

function getOrgMutationOptions(organization: Organization) {
  const orgEndpoint = getApiUrl('/organizations/$organizationIdOrSlug/', {
    path: {organizationIdOrSlug: organization.slug},
  });

  return mutationOptions({
    mutationFn: (data: Partial<Organization>) =>
      fetchMutation<Organization>({method: 'PUT', url: orgEndpoint, data}),
    onSuccess: handleUpdateOrganization,
  });
}

export default function OrganizationSecurityAndPrivacyContent() {
  const organization = useOrganization();
  const orgMutationOptions = getOrgMutationOptions(organization);

  const {data: authProvider} = useApiQuery<AuthProvider>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/auth-provider/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {staleTime: Infinity}
  );

  const features = new Set(organization.features);
  const relayPiiConfig = organization.relayPiiConfig;
  const title = t('Security & Privacy');
  const hasOrgWrite = organization.access.includes('org:write');
  const hasSsoEnabled = !!authProvider;

  const {isSelfHosted} = ConfigStore.getState();
  const showDataSecrecySettings =
    organization.features.includes('data-secrecy') && !isSelfHosted;

  return (
    <FormSearch route="/settings/:orgId/security-and-privacy/">
      <SentryDocumentTitle title={title} orgSlug={organization.slug} />
      <SettingsPageHeader title={title} />

      <FieldGroup title={t('Security & Privacy')}>
        <AutoSaveField
          name="require2FA"
          schema={securitySchema}
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
                disabled={!hasOrgWrite}
                aria-label={t(
                  'Enable to require and enforce two-factor authentication for all members'
                )}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="allowSharedIssues"
          schema={securitySchema}
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
                disabled={!hasOrgWrite}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="enhancedPrivacy"
          schema={securitySchema}
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
                disabled={!hasOrgWrite}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="scrapeJavaScript"
          schema={securitySchema}
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
                disabled={!hasOrgWrite}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        {features.has('event-attachments') && (
          <AutoSaveField
            name="storeCrashReports"
            schema={securitySchema}
            initialValue={organization.storeCrashReports}
            mutationOptions={orgMutationOptions}
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
                  disabled={!hasOrgWrite}
                  options={getStoreCrashReportsValues(SettingScope.ORGANIZATION).map(
                    v => ({
                      value: v,
                      label: formatStoreCrashReports(v),
                    })
                  )}
                />
              </field.Layout.Row>
            )}
          </AutoSaveField>
        )}

        {!hasSsoEnabled && (
          <AutoSaveField
            name="allowJoinRequests"
            schema={securitySchema}
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
                  disabled={!hasOrgWrite}
                  aria-label={t(
                    'Enable to allow users to request to join your organization'
                  )}
                />
              </field.Layout.Row>
            )}
          </AutoSaveField>
        )}
      </FieldGroup>

      <FieldGroup title={t('Data Scrubbing')}>
        <AutoSaveField
          name="dataScrubber"
          schema={dataScrubBooleanSchema}
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
                disabled={!hasOrgWrite}
                aria-label={t('Enable server-side data scrubbing')}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="dataScrubberDefaults"
          schema={dataScrubBooleanSchema}
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
                disabled={!hasOrgWrite}
                aria-label={t(
                  'Enable to apply default scrubbers to prevent things like passwords and credit cards from being stored'
                )}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="scrubIPAddresses"
          schema={dataScrubBooleanSchema}
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
                disabled={!hasOrgWrite}
                aria-label={t(
                  'Enable to prevent IP addresses from being stored for new events'
                )}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>
      </FieldGroup>

      <ScrubbingConfigurationFieldGroup hasOrgWrite={hasOrgWrite} />

      {showDataSecrecySettings && <DataSecrecy />}

      <DataScrubbing
        additionalContext={t(
          'Advanced data scrubbing rules can be configured at the organization level and will apply to all projects. Project-level rules can be configured in addition to organization-level rules.'
        )}
        endpoint={`/organizations/${organization.slug}/`}
        relayPiiConfig={relayPiiConfig}
        organization={organization}
        disabled={!hasOrgWrite}
        onSubmitSuccess={data => handleUpdateOrganization({...organization, ...data})}
      />
    </FormSearch>
  );
}

function ScrubbingConfigurationFieldGroup({hasOrgWrite}: {hasOrgWrite: boolean}) {
  const organization = useOrganization();
  const initialSensitiveFields = convertMultilineFieldValue(organization.sensitiveFields);
  const initialSafeFields = convertMultilineFieldValue(organization.safeFields);
  const orgMutation = useMutation(getOrgMutationOptions(organization));

  const scrubbingConfiguration = useScrapsForm({
    ...defaultFormOptions,
    formId: 'organization-settings-security-and-privacy',
    defaultValues: {
      sensitiveFields: initialSensitiveFields,
      safeFields: initialSafeFields,
    },
    validators: {onDynamic: dataScrubMultilineSchema},
    onSubmit: ({value}) =>
      orgMutation
        .mutateAsync({
          sensitiveFields: extractMultilineFields(value.sensitiveFields),
          safeFields: extractMultilineFields(value.safeFields),
        })
        .then(() => {
          addSuccessMessage(t('Scrubbing configuration updated'));
        })
        .catch(() => {
          addErrorMessage(t('Unable to save change'));
        }),
  });

  return (
    <FormSearch route="/settings/:orgId/security-and-privacy/">
      <scrubbingConfiguration.AppForm>
        <scrubbingConfiguration.FormWrapper>
          <FieldGroup title={t('Scrubbing Configuration')}>
            <scrubbingConfiguration.AppField name="sensitiveFields">
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
                    disabled={!hasOrgWrite}
                    autosize
                  />
                </field.Layout.Row>
              )}
            </scrubbingConfiguration.AppField>

            <scrubbingConfiguration.AppField name="safeFields">
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
                    disabled={!hasOrgWrite}
                    autosize
                  />
                </field.Layout.Row>
              )}
            </scrubbingConfiguration.AppField>
            {hasOrgWrite ? (
              <Flex gap="md" align="center" padding="sm">
                <scrubbingConfiguration.Subscribe
                  selector={state =>
                    state.values.sensitiveFields !== initialSensitiveFields ||
                    state.values.safeFields !== initialSafeFields
                  }
                >
                  {hasChanged => (
                    <Flex
                      flex="1"
                      minWidth={0}
                      style={{visibility: hasChanged ? 'visible' : 'hidden'}}
                    >
                      <Alert variant="info">
                        {t(
                          'Changes to your scrubbing configuration will apply to all new events.'
                        )}
                      </Alert>
                    </Flex>
                  )}
                </scrubbingConfiguration.Subscribe>
                <Flex gap="sm" flexShrink={0}>
                  <Button onClick={() => scrubbingConfiguration.reset()}>
                    {t('Cancel')}
                  </Button>
                  <scrubbingConfiguration.SubmitButton>
                    {t('Save')}
                  </scrubbingConfiguration.SubmitButton>
                </Flex>
              </Flex>
            ) : null}
          </FieldGroup>
        </scrubbingConfiguration.FormWrapper>
      </scrubbingConfiguration.AppForm>
    </FormSearch>
  );
}
