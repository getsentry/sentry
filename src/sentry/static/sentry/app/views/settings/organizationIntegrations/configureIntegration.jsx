import React from 'react';

import {analytics} from 'app/utils/analytics';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import BreadcrumbTitle from 'app/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import Form from 'app/views/settings/components/forms/form';
import IntegrationAlertRules from 'app/views/organizationIntegrations/integrationAlertRules';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import IntegrationRepos from 'app/views/organizationIntegrations/integrationRepos';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import withOrganization from 'app/utils/withOrganization';

class ConfigureIntegration extends AsyncView {
  getEndpoints() {
    const {orgId, integrationId} = this.props.params;

    return [
      ['config', `/organizations/${orgId}/config/integrations/`],
      ['integration', `/organizations/${orgId}/integrations/${integrationId}/`],
    ];
  }

  componentDidMount() {
    analytics('integrations.details_viewed', {
      org_id: parseInt(this.props.organization.id, 10),
      integration: this.props.provider.key,
    });
  }

  getTitle() {
    return this.state.integration
      ? this.state.integration.provider.name
      : 'Configure Integration';
  }

  renderBody() {
    const {orgId} = this.props.params;
    const {integration} = this.state;
    const provider = this.state.config.providers.find(
      p => p.key === integration.provider.key
    );

    const title = <IntegrationItem integration={integration} withProvider={true} />;

    return (
      <React.Fragment>
        <BreadcrumbTitle routes={this.props.routes} title={integration.provider.name} />
        <SettingsPageHeader noTitleStyles title={title} />

        {integration.configOrganization.length > 0 && (
          <Form
            hideFooter={true}
            saveOnBlur={true}
            allowUndo={true}
            apiMethod="POST"
            initialData={integration.configData}
            apiEndpoint={`/organizations/${orgId}/integrations/${integration.id}/`}
          >
            <JsonForm
              fields={integration.configOrganization}
              title={t('Organization Integration Settings')}
            />
          </Form>
        )}

        {provider.features.includes('alert-rule') && (
          <IntegrationAlertRules integration={integration} />
        )}

        {provider.features.includes('commits') && (
          <IntegrationRepos {...this.props} integration={integration} />
        )}
      </React.Fragment>
    );
  }
}

export default withOrganization(ConfigureIntegration);
