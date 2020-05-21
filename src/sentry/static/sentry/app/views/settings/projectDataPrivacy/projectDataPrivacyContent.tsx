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

import DataPrivacyRules from '../components/dataPrivacyRules/dataPrivacyRules';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

class ProjectDataPrivacyContent extends AsyncView<Props> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, project} = this.props;
    return [['data', `/projects/${organization.slug}/${project.slug}/`]];
  }

  handleUpdateProject = (data: Project) => {
    // This will update our project global state
    ProjectActions.updateSuccess(data);
  };

  renderBody() {
    const {organization, project} = this.props;
    const initialData = this.state.data;
    const endpoint = `/projects/${organization.slug}/${project.slug}/`;
    const access = new Set(organization.access);
    const features = new Set(organization.features);
    const relayPiiConfig = initialData?.relayPiiConfig;
    const apiMethod = 'PUT';

    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Data Privacy')} />
        <Form
          saveOnBlur
          allowUndo
          initialData={initialData}
          apiMethod={apiMethod}
          apiEndpoint={endpoint}
          onSubmitSuccess={this.handleUpdateProject}
        >
          <JsonForm
            title={t('Data Privacy')}
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
              fields.storeCrashReports,
            ]}
          />
        </Form>
        <DataPrivacyRules
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
          onSubmitSuccess={resp => {
            this.handleUpdateProject(resp as Project);
          }}
        />
      </React.Fragment>
    );
  }
}

export default ProjectDataPrivacyContent;
