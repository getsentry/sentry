import styled from '@emotion/styled';
import {parseAsStringLiteral, useQueryState} from 'nuqs';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup, FormSearch} from '@sentry/scraps/form';
import {Link} from '@sentry/scraps/link';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {ReplayBulkDeleteAuditLog} from 'sentry/components/replays/bulkDelete/replayBulkDeleteAuditLog';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {ProjectPermissionAlert} from './projectPermissionAlert';
import {useProjectSettingsOutlet} from './projectSettingsLayout';

const replaySchema = z.object({
  'sentry:replay_rage_click_issues': z.boolean(),
  'sentry:replay_hydration_error_issues': z.boolean(),
});

type ReplaySchema = z.infer<typeof replaySchema>;

const ReplaySettingsAlert = OverrideOrDefault({
  overrideName: 'component:replay-settings-alert',
  defaultComponent: null,
});

export default function ProjectReplaySettings() {
  const organization = useOrganization();
  const {project: outletProject} = useProjectSettingsOutlet();
  const {data: project = outletProject} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: outletProject.slug,
  });
  const updateProject = useUpdateProject(project);
  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});
  const hasAdminAccess = hasEveryAccess(['project:admin'], {organization, project});
  const hasAccess = hasWriteAccess || hasAdminAccess;

  const mutationOptions = {
    mutationFn: (data: Partial<ReplaySchema>) =>
      updateProject.mutateAsync({options: data}),
  };

  const [tab, setTab] = useQueryState(
    'replaySettingsTab',
    parseAsStringLiteral(['replay-issues', 'bulk-delete'] as const).withDefault(
      'replay-issues'
    )
  );

  const replayIssuesContent = (
    <FormSearch route="/settings/:orgId/projects/:projectId/replays/">
      <ProjectPermissionAlert project={project} />
      <ReplaySettingsAlert />

      <FieldGroup title={t('Replay Issues')}>
        <AutoSaveForm
          name="sentry:replay_rage_click_issues"
          schema={replaySchema}
          initialValue={!!project.options?.['sentry:replay_rage_click_issues']}
          mutationOptions={mutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Create Rage Click Issues')}
              hintText={t(
                'Toggles whether or not to create Session Replay Rage Click Issues'
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

        <AutoSaveForm
          name="sentry:replay_hydration_error_issues"
          schema={replaySchema}
          initialValue={!!project.options?.['sentry:replay_hydration_error_issues']}
          mutationOptions={mutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Create Hydration Error Issues')}
              hintText={tct(
                'Toggles whether or not to create Session Replay Hydration Error Issues during replay ingest. Using [inboundFilters: inbound filters] to filter out hydration errors does not affect this setting.',
                {
                  inboundFilters: (
                    <Link
                      to={`/settings/${organization.slug}/projects/${project.slug}/filters/data-filters/#filters-react-hydration-errors_help`}
                    />
                  ),
                }
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
    </FormSearch>
  );

  return (
    <SentryDocumentTitle title={t('Replays')} projectSlug={project.slug}>
      <SettingsPageHeader title={t('Replays')} />
      {hasAccess ? (
        <TabsWithGap
          value={tab}
          onChange={value => setTab(value as 'replay-issues' | 'bulk-delete')}
        >
          <TabList>
            <TabList.Item key="replay-issues">{t('Replay Issues')}</TabList.Item>
            <TabList.Item key="bulk-delete">{t('Bulk Delete')}</TabList.Item>
          </TabList>
          <TabPanels>
            <TabPanels.Item key="replay-issues">{replayIssuesContent}</TabPanels.Item>
            <TabPanels.Item key="bulk-delete">
              <p>
                {t(
                  'Deleting replays requires us to remove data from multiple storage locations which can take some time. You can monitor progress and audit requests here.'
                )}
              </p>
              <ReplayBulkDeleteAuditLog projectSlug={project.slug} />
            </TabPanels.Item>
          </TabPanels>
        </TabsWithGap>
      ) : (
        replayIssuesContent
      )}
    </SentryDocumentTitle>
  );
}

const TabsWithGap = styled(Tabs)`
  gap: ${p => p.theme.space.xl};
`;
