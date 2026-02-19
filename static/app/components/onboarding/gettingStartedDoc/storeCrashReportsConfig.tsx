import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveField} from '@sentry/scraps/form';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {
  formatStoreCrashReports,
  getStoreCrashReportsValues,
  SettingScope,
} from 'sentry/utils/crashReports';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {fetchMutation} from 'sentry/utils/queryClient';

const storeCrashReportsSchema = z.object({
  storeCrashReports: z.string(),
});

interface StoreCrashReportsConfigProps {
  organization: Organization;
  projectSlug: Project['slug'];
}

export function StoreCrashReportsConfig({
  projectSlug,
  organization,
}: StoreCrashReportsConfigProps) {
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
  const endpoint = `/projects/${organization.slug}/${projectSlug}/`;

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
      ProjectsStore.onUpdateSuccess(data);
    },
  });

  const options = getStoreCrashReportsValues(SettingScope.PROJECT).map(value => ({
    value: value === null ? '' : String(value),
    label: formatStoreCrashReports(value, organization.storeCrashReports) as string,
  }));

  return (
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
                <a href={`/settings/${organization.slug}/security-and-privacy/`}>
                  {t('organization settings')}
                </a>
              ),
            }
          )}
        >
          <field.Select
            value={field.state.value}
            onChange={field.handleChange}
            options={options}
            disabled={!hasAccess}
          />
        </field.Layout.Row>
      )}
    </AutoSaveField>
  );
}
