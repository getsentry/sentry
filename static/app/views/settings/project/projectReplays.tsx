import styled from '@emotion/styled';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {JsonFormObject} from 'sentry/components/forms/types';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ReplayBulkDeleteAuditLog from 'sentry/components/replays/bulkDelete/replayBulkDeleteAuditLog';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import useUrlParams from 'sentry/utils/url/useUrlParams';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

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

  const formGroups: readonly JsonFormObject[] = [
    {
      title: t('Replay Issues'),
      fields: [
        {
          name: 'sentry:replay_rage_click_issues',
          type: 'boolean',

          // additional data/props that is related to rendering of form field rather than data
          label: t('Create Rage Click Issues'),
          help: t('Toggles whether or not to create Session Replay Rage Click Issues'),
          getData: data => ({options: data}),
        },
        {
          name: 'sentry:replay_hydration_error_issues',
          type: 'boolean',

          // additional data/props that is related to rendering of form field rather than data
          label: t('Create Hydration Error Issues'),
          help() {
            return tct(
              'Toggles whether or not to create Session Replay Hydration Error Issues during replay ingest. Using [inboundFilters: inbound filters] to filter out hydration errors does not affect this setting.',
              {
                inboundFilters: (
                  <Link
                    to={`/settings/${organization.slug}/projects/${project.slug}/filters/data-filters/#filters-react-hydration-errors_help`}
                  />
                ),
              }
            );
          },
          getData: data => ({options: data}),
        },
      ],
    },
  ];

  const {getParamValue, setParamValue} = useUrlParams(
    'replaySettingsTab',
    'replay-issues'
  );

  return (
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

            <Form
              saveOnBlur
              apiMethod="PUT"
              apiEndpoint={`/projects/${organization.slug}/${project.slug}/`}
              initialData={project.options}
              onSubmitSuccess={(
                response // This will update our project context
              ) => ProjectsStore.onUpdateSuccess(response)}
            >
              <JsonForm
                disabled={!hasAccess}
                features={new Set(organization.features)}
                forms={formGroups}
              />
            </Form>
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
  );
}

const TabsWithGap = styled(Tabs)`
  gap: ${p => p.theme.space.xl};
`;
