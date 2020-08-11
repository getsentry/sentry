import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {addErrorMessage} from 'app/actionCreators/indicator';
import Link from 'app/components/links/link';
import {t, tct} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import Form from 'app/views/settings/components/forms/form';
import {fields} from 'app/data/forms/projectGeneralSettings';
import ProjectActions from 'app/actions/projectActions';
import {Organization, Project} from 'app/types';
import withProject from 'app/utils/withProject';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';

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
            title={title}
            additionalFieldProps={{
              organization,
            }}
            features={features}
            disabled={!access.has('project:write')}
            fields={[fields.storeCrashReports]}
          />
          <JsonForm
            title={t('Data Scrubbing')}
            additionalFieldProps={{
              organization,
            }}
            features={features}
            disabled={!access.has('project:write')}
            fields={[
              fields.dataScrubber,
              fields.dataScrubberDefaults,
              fields.scrubIPAddresses,
              fields.sensitiveFields,
              fields.safeFields,
            ]}
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

export default withProject(ProjectSecurityAndPrivacy);
