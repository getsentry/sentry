import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';
import {Link} from '@sentry/scraps/link';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Placeholder} from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {DetailedProject, Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  formatStoreCrashReports,
  getStoreCrashReportsValues,
  SettingScope,
} from 'sentry/utils/crashReports';
import {
  makeDetailedProjectQueryKey,
  useDetailedProject,
} from 'sentry/utils/project/useDetailedProject';
import {fetchMutation} from 'sentry/utils/queryClient';

interface StoreCrashReportsConfigProps {
  organization: Organization;
  projectSlug: Project['slug'];
}

const schema = z.object({
  storeCrashReports: z.number().nullable(),
});

export function StoreCrashReportsConfig({
  projectSlug,
  organization,
}: StoreCrashReportsConfigProps) {
  const queryClient = useQueryClient();
  const {data: project, isPending: isPendingProject} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug,
  });

  if (isPendingProject) {
    // 72px is the height of the form
    return <Placeholder height="72px" />;
  }

  if (!project || !organization.features.includes('event-attachments')) {
    return null;
  }

  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  const standardValues = getStoreCrashReportsValues(SettingScope.PROJECT);
  // Some projects have a legacy value not in the standard options. Include it
  // so the saved setting is visible instead of rendering blank.
  const values = standardValues.includes(project.storeCrashReports)
    ? standardValues
    : [...standardValues, project.storeCrashReports];

  return (
    <AutoSaveForm
      name="storeCrashReports"
      schema={schema}
      initialValue={project.storeCrashReports}
      mutationOptions={{
        mutationFn: (data: Partial<DetailedProject>) =>
          fetchMutation<DetailedProject>({
            method: 'PUT',
            url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/', {
              path: {
                organizationIdOrSlug: organization.slug,
                projectIdOrSlug: projectSlug,
              },
            }),
            data,
          }),
        onSuccess: data => {
          ProjectsStore.onUpdateSuccess(data);
          queryClient.setQueryData(
            makeDetailedProjectQueryKey({orgSlug: organization.slug, projectSlug}),
            prev => ({headers: prev?.headers ?? {}, json: data})
          );
        },
        onError: () => addErrorMessage(t('Unable to save change')),
      }}
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
            disabled={!hasAccess}
            options={values.map(value => ({
              value,
              label: formatStoreCrashReports(value, organization.storeCrashReports),
            }))}
          />
        </field.Layout.Row>
      )}
    </AutoSaveForm>
  );
}
