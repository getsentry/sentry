import styled from '@emotion/styled';
import {z} from 'zod';

import {LinkButton} from '@sentry/scraps/button';
import {AutoSaveField, FieldGroup, FormSearch} from '@sentry/scraps/form';
import {Link} from '@sentry/scraps/link';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';

import {hasEveryAccess} from 'sentry/components/acl/access';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ReplayBulkDeleteAuditLog from 'sentry/components/replays/bulkDelete/replayBulkDeleteAuditLog';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';
import useUrlParams from 'sentry/utils/url/useUrlParams';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

const replaySchema = z.object({
  'sentry:replay_rage_click_issues': z.boolean(),
  'sentry:replay_hydration_error_issues': z.boolean(),
});

type ReplaySchema = z.infer<typeof replaySchema>;

const ReplaySettingsAlert = HookOrDefault({
  hookName: 'component:replay-settings-alert',
  defaultComponent: null,
});

export default function ProjectReplaySettings() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});
  const hasAdminAccess = hasEveryAccess(['project:admin'], {organization, project});
  const hasAccess = hasWriteAccess || hasAdminAccess;

  const projectEndpoint = `/projects/${organization.slug}/${project.slug}/`;

  const mutationOptions = {
    mutationFn: (data: Partial<ReplaySchema>) =>
      fetchMutation<Project>({
        url: projectEndpoint,
        method: 'PUT',
        data: {options: data},
      }),
    onSuccess: (response: Project) => ProjectsStore.onUpdateSuccess(response),
  };

  const {getParamValue, setParamValue} = useUrlParams(
    'replaySettingsTab',
    'replay-issues'
  );

  return (
    <FormSearch route="/settings/:orgId/projects/:projectId/replays/">
      <SentryDocumentTitle title={t('Replays')} projectSlug={project.slug}>
        <SettingsPageHeader
          title={t('Replays')}
          action={
            <LinkButton
              external
              href="https://docs.sentry.io/product/issues/issue-details/replay-issues/"
            >
              {t('Read the Docs')}
            </LinkButton>
          }
        />
        <TabsWithGap
          defaultValue={getParamValue()}
          onChange={value => setParamValue(String(value))}
        >
          <TabList>
            <TabList.Item key="replay-issues">{t('Replay Issues')}</TabList.Item>
            <TabList.Item key="bulk-delete">{t('Bulk Delete')}</TabList.Item>
          </TabList>
          <TabPanels>
            <TabPanels.Item key="replay-issues">
              <ProjectPermissionAlert project={project} />
              <ReplaySettingsAlert />

              <FieldGroup title={t('Replay Issues')}>
                <AutoSaveField
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
                </AutoSaveField>

                <AutoSaveField
                  name="sentry:replay_hydration_error_issues"
                  schema={replaySchema}
                  initialValue={
                    !!project.options?.['sentry:replay_hydration_error_issues']
                  }
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
                </AutoSaveField>
              </FieldGroup>
            </TabPanels.Item>
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
      </SentryDocumentTitle>
    </FormSearch>
  );
}

const TabsWithGap = styled(Tabs)`
  gap: ${p => p.theme.space.xl};
`;
