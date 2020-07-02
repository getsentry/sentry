import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import Link from 'app/components/links/link';
import {t, tct} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import Form from 'app/views/settings/components/forms/form';
import {fields} from 'app/data/forms/projectGeneralSettings';
import AsyncView from 'app/views/asyncView';
import ProjectActions from 'app/actions/projectActions';
import {Organization, Project} from 'app/types';
import withProject from 'app/utils/withProject';

import DataScrubbing from '../components/dataScrubbing';

export type ProjectSecurityAndPrivacyProps = RouteComponentProps<
  {orgId: string; projectId: string},
  {}
> & {
  organization: Organization;
  project: Project;
};

class ProjectSecurityAndPrivacy extends AsyncView<ProjectSecurityAndPrivacyProps> {
  handleUpdateProject = (data: Project) => {
    // This will update our project global state
    ProjectActions.updateSuccess(data);
  };

  renderBody() {
    const {organization, project} = this.props;
    const initialData = project;
    const endpoint = `/projects/${organization.slug}/${project.slug}/`;
    const access = new Set(organization.access);
    const features = new Set(organization.features);
    const relayPiiConfig = project.relayPiiConfig;
    const apiMethod = 'PUT';

    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Security & Privacy')} />
        <Form
          saveOnBlur
          allowUndo
          initialData={initialData}
          apiMethod={apiMethod}
          apiEndpoint={endpoint}
          onSubmitSuccess={this.handleUpdateProject}
        >
          <JsonForm
            title={t('Security & Privacy')}
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
                      {t('Security and Privacy')}
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
