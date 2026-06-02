import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup, FormSearch} from '@sentry/scraps/form';
import {Link} from '@sentry/scraps/link';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {DetailedProject} from 'sentry/types/project';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import {
  formatStoreCrashReports,
  getStoreCrashReportsValues,
  SettingScope,
} from 'sentry/utils/crashReports';
import {makeDetailedProjectQueryKey} from 'sentry/utils/project/useDetailedProject';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DataScrubbing} from 'sentry/views/settings/components/dataScrubbing';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

const securitySchema = z.object({
  storeCrashReports: z.number().nullable(),
});

const dataScrubBooleanSchema = z.object({
  dataScrubber: z.boolean(),
  dataScrubberDefaults: z.boolean(),
  scrubIPAddresses: z.boolean(),
});

const dataScrubMultilineSchema = z.object({
  sensitiveFields: z.string().transform(extractMultilineFields),
  safeFields: z.string().transform(extractMultilineFields),
});

function getScrubberDisabledReason({
  orgOverride,
  hasAccess,
}: {
  hasAccess: boolean;
  orgOverride: boolean;
}): string | false {
  if (orgOverride) {
    return t(
      "This option is enforced by your organization's settings and cannot be customized per-project."
    );
  }
  if (!hasAccess) {
    return t("You do not have permission to modify this project's setting.");
  }
  return false;
}

// null = inherit, but a null-valued select option warns (controlled-null hidden input), so map to a sentinel.
const INHERIT_VALUE = 'inherit';

function getStoreCrashReportsOptions(
  orgValue: number,
  currentValue: number | null
): Array<{
  label: ReturnType<typeof formatStoreCrashReports>;
  value: number | typeof INHERIT_VALUE;
}> {
  const values = getStoreCrashReportsValues(SettingScope.PROJECT).filter(
    value => value !== null
  );
  if (currentValue !== null && !values.includes(currentValue)) {
    values.push(currentValue);
  }
  return [
    {value: INHERIT_VALUE, label: formatStoreCrashReports(null, orgValue)},
    ...values.map(value => ({value, label: formatStoreCrashReports(value, orgValue)})),
  ];
}

export default function ProjectSecurityAndPrivacy() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const queryClient = useQueryClient();

  const updateProject = useUpdateProject(project);
  const projectMutationOptions = {
    mutationFn: (data: Partial<DetailedProject>) => updateProject.mutateAsync(data),
  };

  const title = t('Security & Privacy');
  const features = new Set(organization.features);
  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  return (
    <FormSearch route="/settings/:orgId/projects/:projectId/security-and-privacy/">
      <SentryDocumentTitle title={title} projectSlug={project.slug} />
      <SettingsPageHeader title={title} />
      <ProjectPermissionAlert project={project} />

      {features.has('event-attachments') && (
        <FieldGroup title={t('Security & Privacy')}>
          <AutoSaveForm
            name="storeCrashReports"
            schema={securitySchema}
            initialValue={project.storeCrashReports}
            mutationOptions={projectMutationOptions}
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
                  value={field.state.value ?? INHERIT_VALUE}
                  onChange={value =>
                    field.handleChange(value === INHERIT_VALUE ? null : value)
                  }
                  disabled={!hasAccess}
                  options={getStoreCrashReportsOptions(
                    organization.storeCrashReports,
                    field.state.value
                  )}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        </FieldGroup>
      )}

      <FieldGroup title={t('Data Scrubbing')}>
        <AutoSaveForm
          name="dataScrubber"
          schema={dataScrubBooleanSchema}
          initialValue={
            Boolean(organization.dataScrubber) || Boolean(project.dataScrubber)
          }
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
                disabled={getScrubberDisabledReason({
                  orgOverride: Boolean(organization.dataScrubber),
                  hasAccess,
                })}
                aria-label={t('Enable server-side data scrubbing')}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>

        <AutoSaveForm
          name="dataScrubberDefaults"
          schema={dataScrubBooleanSchema}
          initialValue={
            Boolean(organization.dataScrubberDefaults) ||
            Boolean(project.dataScrubberDefaults)
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
                disabled={getScrubberDisabledReason({
                  orgOverride: Boolean(organization.dataScrubberDefaults),
                  hasAccess,
                })}
                aria-label={t(
                  'Enable to apply default scrubbers to prevent things like passwords and credit cards from being stored'
                )}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>

        <AutoSaveForm
          name="scrubIPAddresses"
          schema={dataScrubBooleanSchema}
          initialValue={
            Boolean(organization.scrubIPAddresses) || Boolean(project.scrubIPAddresses)
          }
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
                disabled={getScrubberDisabledReason({
                  orgOverride: Boolean(organization.scrubIPAddresses),
                  hasAccess,
                })}
                aria-label={t(
                  'Enable to prevent IP addresses from being stored for new events'
                )}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>

        <AutoSaveForm
          name="sensitiveFields"
          schema={dataScrubMultilineSchema}
          initialValue={convertMultilineFieldValue(project.sensitiveFields)}
          mutationOptions={projectMutationOptions}
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
                disabled={!hasAccess}
                autosize
                rows={1}
                maxRows={10}
                aria-label={t(
                  'Enter additional field names to match against when scrubbing data. Separate multiple entries with a newline'
                )}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>

        <AutoSaveForm
          name="safeFields"
          schema={dataScrubMultilineSchema}
          initialValue={convertMultilineFieldValue(project.safeFields)}
          mutationOptions={projectMutationOptions}
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
                disabled={!hasAccess}
                autosize
                rows={1}
                maxRows={10}
                aria-label={t(
                  'Enter field names which data scrubbers should ignore. Separate multiple entries with a newline'
                )}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>

      <DataScrubbing
        additionalContext={tct(
          'Advanced data scrubbing rules can be configured for each project. These rules will be applied in addition to any organization-level rules configured in [linkToOrganizationSecurityAndPrivacy].',
          {
            linkToOrganizationSecurityAndPrivacy: (
              <Link to={`/settings/${organization.slug}/security-and-privacy/`}>
                {title}
              </Link>
            ),
          }
        )}
        endpoint={`/projects/${organization.slug}/${project.slug}/`}
        relayPiiConfig={project.relayPiiConfig}
        disabled={!hasAccess}
        organization={organization}
        project={project}
        onSubmitSuccess={data => {
          // DataScrubbing saves itself; mirror useUpdateProject's cache writes instead of re-mutating.
          const updatedProject = {...project, ...data};
          ProjectsStore.onUpdateSuccess(updatedProject);
          queryClient.setQueryData(
            makeDetailedProjectQueryKey({
              orgSlug: organization.slug,
              projectSlug: project.slug,
            }),
            prev =>
              prev
                ? {...prev, json: {...prev.json, ...data}}
                : {headers: {}, json: updatedProject}
          );
        }}
      />
    </FormSearch>
  );
}
