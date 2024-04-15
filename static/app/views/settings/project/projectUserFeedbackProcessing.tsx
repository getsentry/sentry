import type {RouteComponentProps} from 'react-router';

import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import formGroups from 'sentry/data/forms/userFeedbackProcessing';
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

function ProjectUserFeedbackProcessingSettings({
  project,
  organization,
  params: {projectId},
}: Props) {
  return (
    <SentryDocumentTitle title={t('User Feedback')} projectSlug={project.slug}>
      <SettingsPageHeader
        title={t('User Feedback')}
        action={
          <Button external href="https://docs.sentry.io/product/user-feedback/">
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

export default ProjectUserFeedbackProcessingSettings;
