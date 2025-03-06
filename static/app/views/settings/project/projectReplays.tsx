import Access from 'sentry/components/acl/access';
import {LinkButton} from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {JsonFormObject} from 'sentry/components/forms/types';
import Link from 'sentry/components/links/link';
import ReplaySettingsAlert from 'sentry/components/replays/alerts/replaySettingsAlert';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

type RouteParams = {
  projectId: string;
};
type Props = RouteComponentProps<RouteParams> & {
  organization: Organization;
  project: Project;
};

function ProjectReplaySettings({organization, project, params: {projectId}}: Props) {
  const formGroups: JsonFormObject[] = [
    {
      title: 'Settings',
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
      <ProjectPermissionAlert project={project} />
      <ReplaySettingsAlert />

      <Form
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint={`/projects/${organization.slug}/${projectId}/`}
        initialData={project.options}
        onSubmitSuccess={(
          response // This will update our project context
        ) => ProjectsStore.onUpdateSuccess(response)}
      >
        <Access access={['project:write']} project={project}>
          {({hasAccess}) => (
            <JsonForm
              disabled={!hasAccess}
              features={new Set(organization.features)}
              forms={formGroups}
            />
          )}
        </Access>
      </Form>
    </SentryDocumentTitle>
  );
}

export default ProjectReplaySettings;
