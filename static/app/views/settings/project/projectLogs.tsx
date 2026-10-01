import {z} from 'zod';

import {AutoSaveForm, FieldGroup, FormSearch} from '@sentry/scraps/form';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

const logsSchema = z.object({
  'sentry:relay_automatic_json_expansion': z.boolean(),
});

type LogsSchema = z.infer<typeof logsSchema>;

function ProjectLogsSettings() {
  const organization = useOrganization();
  const {project: outletProject} = useProjectSettingsOutlet();
  const {data: project = outletProject} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: outletProject.slug,
  });
  const updateProject = useUpdateProject(project);
  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  const mutationOptions = {
    mutationFn: (data: Partial<LogsSchema>) => updateProject.mutateAsync({options: data}),
  };

  return (
    <FormSearch route="/settings/:orgId/projects/:projectId/logs/">
      <SentryDocumentTitle title={t('Logs')} projectSlug={project.slug}>
        <SettingsPageHeader title={t('Logs')} />
        <ProjectPermissionAlert project={project} />

        <FieldGroup title={t('Attributes')}>
          <AutoSaveForm
            name="sentry:relay_automatic_json_expansion"
            schema={logsSchema}
            initialValue={!!project.options?.['sentry:relay_automatic_json_expansion']}
            mutationOptions={mutationOptions}
          >
            {field => (
              <field.Layout.Row
                label={t('Expand JSON Attributes')}
                hintText={t(
                  'Object attributes are sent as strings. Turn this on to expand them into nested attributes you can search on. Only applies to logs received after this is enabled.'
                )}
              >
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={!hasAccess}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        </FieldGroup>
      </SentryDocumentTitle>
    </FormSearch>
  );
}

export default function ProjectLogs() {
  return (
    <Feature features="explore-automatic-json-expansion-ui">
      <ProjectLogsSettings />
    </Feature>
  );
}
