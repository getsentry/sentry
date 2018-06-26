import React from 'react';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import BreadcrumbTitle from 'app/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import Form from 'app/views/settings/components/forms/form';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

class ProjectIntegration extends AsyncView {
  getEndpoints() {
    const {orgId, projectId, integrationId} = this.props.params;

    return [
      ['integration', `/projects/${orgId}/${projectId}/integrations/${integrationId}/`],
    ];
  }

  getTitle() {
    return this.state.integration ? this.state.integration.name : 'Configure Integration';
  }

  renderBody() {
    const {orgId, projectId} = this.props.params;
    const {integration} = this.state;

    const title = <IntegrationItem integration={integration} />;

    return (
      <React.Fragment>
        <BreadcrumbTitle routes={this.props.routes} title={integration.name} />
        <SettingsPageHeader noTitleStyles title={title} />

        {integration.configProject.length > 0 && (
          <Form
            hideFooter={true}
            saveOnBlur={true}
            allowUndo={true}
            apiMethod="POST"
            initialData={integration.configData}
            apiEndpoint={`/projects/${orgId}/${projectId}/integrations/${integration.id}/`}
          >
            <JsonForm
              fields={integration.configProject}
              title={t('Integration Project Settings')}
            />
          </Form>
        )}
      </React.Fragment>
    );
  }
}

export default ProjectIntegration;
