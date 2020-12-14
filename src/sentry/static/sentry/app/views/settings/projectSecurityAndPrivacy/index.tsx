import React from 'react';
import {RouteComponentProps} from 'react-router';

import {addErrorMessage} from 'app/actionCreators/indicator';
import ProjectActions from 'app/actions/projectActions';
import Link from 'app/components/links/link';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import projectSecurityAndPrivacyGroups from 'app/data/forms/projectSecurityAndPrivacyGroups';
import {t, tct} from 'app/locale';
import {Organization, Project} from 'app/types';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

import DataScrubbing from '../components/dataScrubbing';

export type ProjectSecurityAndPrivacyProps = RouteComponentProps<
  {orgId: string; projectId: string},
  {}
> & {
  organization: Organization;
  project: Project;
};

class ProjectSecurityAndPrivacy extends React.Component<ProjectSecurityAndPrivacyProps> {
  handleUpdateProject = (data: Project) => {
    // This will update our project global state
    ProjectActions.updateSuccess(data);
  };

  render() {
    const {organization, project} = this.props;
    const initialData = project;
    const projectSlug = project.slug;
    const endpoint = `/projects/${organization.slug}/${projectSlug}/`;
    const access = new Set(organization.access);
    const features = new Set(organization.features);
    const relayPiiConfig = project.relayPiiConfig;
    const apiMethod = 'PUT';
    const title = t('Security & Privacy');

    return (
      <React.Fragment>
        <SentryDocumentTitle title={title} objSlug={projectSlug} />
        <SettingsPageHeader title={title} />
        <Form
          saveOnBlur
          allowUndo
          initialData={initialData}
          apiMethod={apiMethod}
          apiEndpoint={endpoint}
          onSubmitSuccess={this.handleUpdateProject}
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
          projectId={project.id}
          onSubmitSuccess={this.handleUpdateProject}
        />
      </React.Fragment>
    );
  }
}

export default ProjectSecurityAndPrivacy;
