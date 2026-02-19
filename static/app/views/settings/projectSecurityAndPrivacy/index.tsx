import {Fragment} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveField, FieldGroup} from '@sentry/scraps/form';
import {Link} from '@sentry/scraps/link';

import {hasEveryAccess} from 'sentry/components/acl/access';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import {
  formatStoreCrashReports,
  getStoreCrashReportsValues,
  SettingScope,
} from 'sentry/utils/crashReports';
import {fetchMutation} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {DataScrubbing} from 'sentry/views/settings/components/dataScrubbing';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

const storeCrashReportsSchema = z.object({
  storeCrashReports: z.string(),
});

const projectSecuritySchema = z.object({
  dataScrubber: z.boolean(),
  dataScrubberDefaults: z.boolean(),
  scrubIPAddresses: z.boolean(),
  sensitiveFields: z.string(),
  safeFields: z.string(),
});

type ProjectSecurityData = Partial<z.infer<typeof projectSecuritySchema>>;

function getDisabledReason(
  organization: Organization,
  project: Project,
  name: string
): string | false {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type
  if (organization[name]) {
    return t(
      "This option is enforced by your organization's settings and cannot be customized per-project."
    );
  }

  if (!hasEveryAccess(['project:write'], {organization, project})) {
    return t("You do not have permission to modify this project's setting.");
  }

  return false;
}

export default function ProjectSecurityAndPrivacy() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  function handleUpdateProject(data: Project) {
    ProjectsStore.onUpdateSuccess(data);
  }

  const projectSlug = project.slug;
  const endpoint = `/projects/${organization.slug}/${projectSlug}/`;
  const relayPiiConfig = project.relayPiiConfig;
  const title = t('Security & Privacy');
  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  const projectMutationOptions = mutationOptions({
    mutationFn: (data: ProjectSecurityData) => {
      return fetchMutation<Project>({
        method: 'PUT',
        url: endpoint,
        data,
      });
    },
    onSuccess: data => {
      handleUpdateProject(data);
    },
  });

  const storeCrashReportsMutationOptions = mutationOptions({
    mutationFn: (data: {storeCrashReports: string}) => {
      const value = data.storeCrashReports === '' ? null : Number(data.storeCrashReports);
      return fetchMutation<Project>({
        method: 'PUT',
        url: endpoint,
        data: {storeCrashReports: value},
      });
    },
    onSuccess: data => {
      handleUpdateProject(data);
    },
  });

  const sensitiveFieldsMutationOptions = mutationOptions({
    mutationFn: (data: {sensitiveFields: string}) => {
      return fetchMutation<Project>({
        method: 'PUT',
        url: endpoint,
        data: {sensitiveFields: extractMultilineFields(data.sensitiveFields)},
      });
    },
    onSuccess: data => {
      handleUpdateProject(data);
    },
  });

  const safeFieldsMutationOptions = mutationOptions({
    mutationFn: (data: {safeFields: string}) => {
      return fetchMutation<Project>({
        method: 'PUT',
        url: endpoint,
        data: {safeFields: extractMultilineFields(data.safeFields)},
      });
    },
    onSuccess: data => {
      handleUpdateProject(data);
    },
  });

  const storeCrashReportsOptions = getStoreCrashReportsValues(SettingScope.PROJECT).map(
    value => ({
      value: value === null ? '' : String(value),
      label: formatStoreCrashReports(value, organization.storeCrashReports) as string,
    })
  );

  const dataScrubberDisabled = getDisabledReason(organization, project, 'dataScrubber');
  const dataScrubberDefaultsDisabled = getDisabledReason(
    organization,
    project,
    'dataScrubberDefaults'
  );
  const scrubIPAddressesDisabled = getDisabledReason(
    organization,
    project,
    'scrubIPAddresses'
  );

  return (
    <Fragment>
      <SentryDocumentTitle title={title} projectSlug={projectSlug} />
      <SettingsPageHeader title={title} />
      <ProjectPermissionAlert project={project} />

      {organization.features.includes('event-attachments') && (
        <FieldGroup title={t('Security & Privacy')}>
          <AutoSaveField
            name="storeCrashReports"
            schema={storeCrashReportsSchema}
            initialValue={
              project.storeCrashReports === null ? '' : String(project.storeCrashReports)
            }
            mutationOptions={storeCrashReportsMutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Store Minidumps As Attachments')}
                hintText={tct(
                  'Store minidumps as attachments for improved processing and download in issue details. Overrides [organizationSettingsLink: organization settings].',
                  {
                    organizationSettingsLink: (
                      <Link to={`/settings/${organization.slug}/security-and-privacy/`} />
                    ),
                  }
                )}
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={storeCrashReportsOptions}
                  disabled={!hasAccess}
                />
              </field.Layout.Row>
            )}
          </AutoSaveField>
        </FieldGroup>
      )}

      <FieldGroup title={t('Data Scrubbing')}>
        <AutoSaveField
          name="dataScrubber"
          schema={projectSecuritySchema}
          // @ts-expect-error TS(2339): dataScrubber exists on API response but not typed
          initialValue={organization.dataScrubber || project.dataScrubber}
          mutationOptions={projectMutationOptions}
          confirm={value =>
            value
              ? undefined
              : t('Are you sure you want to disable server-side data scrubbing?')
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Data Scrubber')}
              hintText={t('Enable server-side data scrubbing')}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={dataScrubberDisabled || undefined}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="dataScrubberDefaults"
          schema={projectSecuritySchema}
          initialValue={
            // @ts-expect-error TS(2339): dataScrubberDefaults exists on API response but not typed
            organization.dataScrubberDefaults || project.dataScrubberDefaults
          }
          mutationOptions={projectMutationOptions}
          confirm={value =>
            value
              ? undefined
              : t('Are you sure you want to disable using default scrubbers?')
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Use Default Scrubbers')}
              hintText={t(
                'Apply default scrubbers to prevent things like passwords and credit cards from being stored'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={dataScrubberDefaultsDisabled || undefined}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="scrubIPAddresses"
          schema={projectSecuritySchema}
          initialValue={organization.scrubIPAddresses || project.scrubIPAddresses}
          mutationOptions={projectMutationOptions}
          confirm={value =>
            value
              ? undefined
              : t('Are you sure you want to disable scrubbing IP addresses?')
          }
        >
          {field => (
            <field.Layout.Row
              label={t('Prevent Storing of IP Addresses')}
              hintText={t('Preventing IP addresses from being stored for new events')}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={scrubIPAddressesDisabled || undefined}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="sensitiveFields"
          schema={projectSecuritySchema}
          initialValue={convertMultilineFieldValue(project.sensitiveFields)}
          mutationOptions={sensitiveFieldsMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Additional Sensitive Fields')}
              hintText={t(
                'Additional field names to match against when scrubbing data. Separate multiple entries with a newline'
              )}
            >
              <field.TextArea
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('email')}
                rows={1}
                autosize
                maxRows={10}
                disabled={!hasAccess}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>

        <AutoSaveField
          name="safeFields"
          schema={projectSecuritySchema}
          initialValue={convertMultilineFieldValue(project.safeFields)}
          mutationOptions={safeFieldsMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Safe Fields')}
              hintText={t(
                'Field names which data scrubbers should ignore. Separate multiple entries with a newline'
              )}
            >
              <field.TextArea
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t('business-email')}
                rows={1}
                autosize
                maxRows={10}
                disabled={!hasAccess}
              />
            </field.Layout.Row>
          )}
        </AutoSaveField>
      </FieldGroup>

      <DataScrubbing
        additionalContext={
          <span>
            {tct(
              'Advanced data scrubbing rules can be configured for each project. These rules will be applied in addition to any organization-level rules configured in [linkToOrganizationSecurityAndPrivacy].',
              {
                linkToOrganizationSecurityAndPrivacy: (
                  <Link to={`/settings/${organization.slug}/security-and-privacy/`}>
                    {title}
                  </Link>
                ),
              }
            )}
          </span>
        }
        endpoint={endpoint}
        relayPiiConfig={relayPiiConfig}
        disabled={!hasAccess}
        organization={organization}
        project={project}
        onSubmitSuccess={data => handleUpdateProject({...project, ...data})}
      />
    </Fragment>
  );
}
