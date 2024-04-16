import type {RouteComponentProps} from 'react-router';

import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import formGroups from 'sentry/data/forms/replay';
import {t} from 'sentry/locale';
import type {Organization, Project} from 'sentry/types';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

type RouteParams = {
  projectId: string;
};
type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
};

function ProjectReplaySettings({organization, project, params: {projectId}}: Props) {
  return (
    <SentryDocumentTitle title={t('Replays')} projectSlug={project.slug}>
      <SettingsPageHeader
        title={t('Replays')}
        action={
          <Button
            external
            href="https://docs.sentry.io/product/session-replay/replay-page-and-filters/"
          >
            {t('Read the docs')}
          </Button>
        }
      />
      <PermissionAlert project={project} />
      <Form
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint={`/projects/${organization.slug}/${projectId}/`}
        initialData={project.options}
      >
        <Access access={['project:write']} project={project}>
          {({hasAccess}) => <JsonForm disabled={!hasAccess} forms={formGroups} />}
        </Access>
      </Form>
    </SentryDocumentTitle>
  );
}

export default ProjectReplaySettings;
