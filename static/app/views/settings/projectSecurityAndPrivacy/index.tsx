import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import ProjectActions from 'sentry/actions/projectActions';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import Link from 'sentry/components/links/link';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import projectSecurityAndPrivacyGroups from 'sentry/data/forms/projectSecurityAndPrivacyGroups';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import DataScrubbing from '../components/dataScrubbing';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

class ProjectSecurityAndPrivacy extends Component<Props> {
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
      <Fragment>
        <SentryDocumentTitle title={title} projectSlug={projectSlug} />
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
      </Fragment>
    );
  }
}

export default ProjectSecurityAndPrivacy;
