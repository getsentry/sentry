import {Fragment} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import Link from 'sentry/components/links/link';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import projectSecurityAndPrivacyGroups from 'sentry/data/forms/projectSecurityAndPrivacyGroups';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {Organization, Project} from 'sentry/types';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import {DataScrubbing} from '../components/dataScrubbing';

type Props = {
  organization: Organization;
  project: Project;
};

export default function ProjectSecurityAndPrivacy({organization, project}: Props) {
  function handleUpdateProject(data: Project) {
    // This will update our project global state
    ProjectsStore.onUpdateSuccess(data);
  }

  const initialData = project;
  const projectSlug = project.slug;
  const endpoint = `/projects/${organization.slug}/${projectSlug}/`;
  const access = new Set(organization.access);
  const features = new Set(organization.features);
  const relayPiiConfig = project.relayPiiConfig;
  const apiMethod = 'PUT';
  const title = t('Security & Privacy');

  return (
    <Fragment>
      <SentryDocumentTitle title={title} projectSlug={projectSlug} />
      <SettingsPageHeader title={title} />
      <Form
        saveOnBlur
        allowUndo
        initialData={initialData}
        apiMethod={apiMethod}
        apiEndpoint={endpoint}
        onSubmitSuccess={handleUpdateProject}
        onSubmitError={() => addErrorMessage('Unable to save change')}
      >
        <JsonForm
          additionalFieldProps={{organization}}
          features={features}
          disabled={!access.has('project:write')}
          forms={projectSecurityAndPrivacyGroups}
        />
      </Form>
      <DataScrubbing
        additionalContext={
          <span>
            {tct(
              'These rules can be configured at the organization level in [linkToOrganizationSecurityAndPrivacy].',
              {
                linkToOrganizationSecurityAndPrivacy: (
                  <Link to={`/settings/${organization.slug}/security-and-privacy/`}>
                    {title}
                  </Link>
                ),
              }
            )}
          </span>
        }
        endpoint={endpoint}
        relayPiiConfig={relayPiiConfig}
        disabled={!access.has('project:write')}
        organization={organization}
        project={project}
        onSubmitSuccess={data => handleUpdateProject({...project, ...data})}
      />
    </Fragment>
  );
}
