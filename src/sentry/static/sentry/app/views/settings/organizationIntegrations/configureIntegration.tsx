import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import AddIntegration from 'app/views/organizationIntegrations/addIntegration';
import BreadcrumbTitle from 'app/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import Button from 'app/components/button';
import {IconAdd} from 'app/icons';
import Form from 'app/views/settings/components/forms/form';
import IntegrationAlertRules from 'app/views/organizationIntegrations/integrationAlertRules';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import IntegrationRepos from 'app/views/organizationIntegrations/integrationRepos';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import withOrganization from 'app/utils/withOrganization';
import {Organization, Integration, IntegrationProvider} from 'app/types';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';

type RouteParams = {
  orgId: string;
  integrationId: string;
};
type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};
type State = AsyncView['state'] & {
  config: {providers: IntegrationProvider[]};
  integration: Integration;
};
class ConfigureIntegration extends AsyncView<Props, State> {
  getEndpoints(): [string, string][] {
    const {orgId, integrationId} = this.props.params;

    return [
      ['config', `/organizations/${orgId}/config/integrations/`],
      ['integration', `/organizations/${orgId}/integrations/${integrationId}/`],
    ];
  }

  onRequestSuccess({stateKey, data}) {
    if (stateKey !== 'integration') {
      return;
    }
    trackIntegrationEvent(
      {
        eventKey: 'integrations.details_viewed',
        eventName: 'Integrations: Details Viewed',
        integration: data.provider.key,
        integration_type: 'first_party',
      },
      this.props.organization
    );
  }

  getTitle() {
    return this.state.integration
      ? this.state.integration.provider.name
      : 'Configure Integration';
  }

  onUpdateIntegration = () => {
    this.setState(this.getDefaultState(), this.fetchData);
  };

  getAction = (provider: IntegrationProvider | undefined) => {
    const {integration} = this.state;
    const action =
      provider && provider.key === 'pagerduty' ? (
        <AddIntegration
          provider={provider}
          onInstall={this.onUpdateIntegration}
          account={integration.domainName}
        >
          {onClick => (
            <Button
              priority="primary"
              size="small"
              icon={<IconAdd size="xs" isCircled />}
              onClick={() => onClick()}
            >
              {t('Add Services')}
            </Button>
          )}
        </AddIntegration>
      ) : null;

    return action;
  };

  renderBody() {
    const {orgId} = this.props.params;
    const {integration} = this.state;
    const provider = this.state.config.providers.find(
      p => p.key === integration.provider.key
    );

    const title = <IntegrationItem integration={integration} />;

    return (
      <React.Fragment>
        <BreadcrumbTitle routes={this.props.routes} title={integration.provider.name} />
        <SettingsPageHeader
          noTitleStyles
          title={title}
          action={this.getAction(provider)}
        />

        {integration.configOrganization.length > 0 && (
          <Form
            hideFooter
            saveOnBlur
            allowUndo
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

        {provider && provider.features.includes('alert-rule') && (
          <IntegrationAlertRules integration={integration} />
        )}

        {provider && provider.features.includes('commits') && (
          <IntegrationRepos {...this.props} integration={integration} />
        )}
      </React.Fragment>
    );
  }
}

export default withOrganization(ConfigureIntegration);
