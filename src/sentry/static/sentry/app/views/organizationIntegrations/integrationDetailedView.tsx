import keyBy from 'lodash/keyBy';
import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {RequestOptions} from 'app/api';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import {IconFlag, IconOpen, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Integration, IntegrationProvider} from 'app/types';
import {ProjectMapperType} from 'app/views/settings/components/forms/type';
import {sortArray} from 'app/utils';
import {isSlackWorkspaceApp, getReauthAlertText} from 'app/utils/integrationUtil';
import withOrganization from 'app/utils/withOrganization';

import AbstractIntegrationDetailedView from './abstractIntegrationDetailedView';
import AddIntegrationButton from './addIntegrationButton';
import InstalledIntegration from './installedIntegration';

type State = {
  configurations: Integration[];
  information: {providers: IntegrationProvider[]};
};

class IntegrationDetailedView extends AbstractIntegrationDetailedView<
  AbstractIntegrationDetailedView['props'],
  State & AbstractIntegrationDetailedView['state']
> {
  getEndpoints(): ([string, string, any] | [string, string])[] {
    const {orgId, integrationSlug} = this.props.params;
    const baseEndpoints: ([string, string, any] | [string, string])[] = [
      [
        'information',
        `/organizations/${orgId}/config/integrations/?provider_key=${integrationSlug}`,
      ],
      [
        'configurations',
        `/organizations/${orgId}/integrations/?provider_key=${integrationSlug}`,
      ],
    ];

    return baseEndpoints;
  }

  get integrationType() {
    return 'first_party' as const;
  }

  get provider() {
    return this.state.information.providers[0];
  }

  get description() {
    return this.metadata.description;
  }

  get author() {
    return this.metadata.author;
  }

  get alerts() {
    const provider = this.provider;
    const metadata = this.metadata;
    // The server response for integration installations includes old icon CSS classes
    // We map those to the currently in use values to their react equivalents
    // and fallback to IconFlag just in case.
    const alerts = (metadata.aspects.alerts || []).map(item => {
      switch (item.icon) {
        case 'icon-warning':
        case 'icon-warning-sm':
          return {...item, icon: <IconWarning />};
        default:
          return {...item, icon: <IconFlag />};
      }
    });

    if (!provider.canAdd && metadata.aspects.externalInstall) {
      alerts.push({
        type: 'warning',
        icon: <IconOpen />,
        text: metadata.aspects.externalInstall.noticeText,
      });
    }
    return alerts;
  }

  get resourceLinks() {
    const metadata = this.metadata;
    return [
      {url: metadata.source_url, title: 'View Source'},
      {url: metadata.issue_url, title: 'Report Issue'},
    ];
  }

  get metadata() {
    return this.provider.metadata;
  }

  get isEnabled() {
    return this.state.configurations.length > 0;
  }

  get installationStatus() {
    return this.isEnabled ? 'Installed' : 'Not Installed';
  }

  get integrationName() {
    return this.provider.name;
  }

  get featureData() {
    return this.metadata.features;
  }

  onInstall = (integration: Integration) => {
    // Merge the new integration into the list. If we're updating an
    // integration overwrite the old integration.
    const keyedItems = keyBy(this.state.configurations, i => i.id);

    const configurations = sortArray(
      Object.values({...keyedItems, [integration.id]: integration}),
      i => i.name
    );
    this.setState({configurations});
  };

  onRemove = (integration: Integration) => {
    const {orgId} = this.props.params;

    const origIntegrations = [...this.state.configurations];

    const integrations = this.state.configurations.filter(i => i.id !== integration.id);
    this.setState({configurations: integrations});

    const options: RequestOptions = {
      method: 'DELETE',
      error: () => {
        this.setState({configurations: origIntegrations});
        addErrorMessage(t('Failed to remove Integration'));
      },
    };

    this.api.request(`/organizations/${orgId}/integrations/${integration.id}/`, options);
  };

  onDisable = (integration: Integration) => {
    let url: string;

    if (integration.provider.key === 'vercel') {
      // kind of a hack since this isn't what the url was stored for
      // but it's exactly what we need and contains the configuration id
      // e.g. https://vercel.com/dashboard/<team>/integrations/icfg_ySlF4UDnHcIPrAAXjGEiwtxo
      const field = integration.configOrganization.find(
        config => config.type === 'project_mapper'
      );

      if (field) {
        const mappingField = field as ProjectMapperType;
        url = mappingField.nextButton.url || '';
        window.open(url, '_blank');
      }
      return;
    }

    const [domainName, orgName] = integration.domainName.split('/');
    if (integration.accountType === 'User') {
      url = `https://${domainName}/settings/installations/`;
    } else {
      url = `https://${domainName}/organizations/${orgName}/settings/installations/`;
    }

    window.open(url, '_blank');
  };

  handleExternalInstall = () => {
    this.trackIntegrationEvent({
      eventKey: 'integrations.installation_start',
      eventName: 'Integrations: Installation Start',
    });
  };

  renderTopButton(disabledFromFeatures: boolean, userHasAccess: boolean) {
    const {organization} = this.props;
    const provider = this.provider;
    const {metadata} = provider;

    const size = 'small' as const;
    const priority = 'primary' as const;

    const buttonProps = {
      style: {marginBottom: space(1)},
      size,
      priority,
      'data-test-id': 'install-button',
      disabled: disabledFromFeatures,
      organization,
    };

    if (!userHasAccess) {
      return this.renderRequestIntegrationButton();
    }

    if (provider.canAdd) {
      return (
        <AddIntegrationButton
          provider={provider}
          onAddIntegration={this.onInstall}
          analyticsParams={{
            view: 'integrations_directory_integration_detail',
            already_installed: this.installationStatus !== 'Not Installed',
          }}
          {...buttonProps}
        />
      );
    }
    if (metadata.aspects.externalInstall) {
      return (
        <Button
          icon={<IconOpen />}
          href={metadata.aspects.externalInstall.url}
          onClick={this.handleExternalInstall}
          external
          {...buttonProps}
        >
          {metadata.aspects.externalInstall.buttonText}
        </Button>
      );
    }

    // This should never happen but we can't return undefined without some refactoring.
    return <React.Fragment />;
  }

  renderConfigurations() {
    const {configurations} = this.state;
    const {organization} = this.props;
    const provider = this.provider;
    if (configurations.length) {
      // check if we have a workspace app to render the alert
      const hasWorkspaceApp = configurations.some(isSlackWorkspaceApp);

      return (
        <Feature organization={organization} features={['slack-migration']}>
          {({hasFeature}) => (
            <div>
              {hasFeature && hasWorkspaceApp && (
                <Alert type="warning" icon={<IconWarning size="sm" />}>
                  {getReauthAlertText(provider)}
                </Alert>
              )}
              {configurations.map(integration => (
                <InstallWrapper key={integration.id}>
                  <InstalledIntegration
                    organization={organization}
                    provider={provider}
                    integration={integration}
                    onRemove={this.onRemove}
                    onDisable={this.onDisable}
                    onReAuthIntegration={this.onInstall}
                    data-test-id={integration.id}
                    trackIntegrationEvent={this.trackIntegrationEvent}
                    showReauthMessage={hasFeature && isSlackWorkspaceApp(integration)}
                  />
                </InstallWrapper>
              ))}
            </div>
          )}
        </Feature>
      );
    }
    return this.renderEmptyConfigurations();
  }
}

const InstallWrapper = styled('div')`
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.borderLight};
  border-bottom: none;
  background-color: white;

  &:last-child {
    border-bottom: 1px solid ${p => p.theme.borderLight};
  }
`;

export default withOrganization(IntegrationDetailedView);
