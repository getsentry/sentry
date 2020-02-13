import React from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';

import {Integration, IntegrationProvider} from 'app/types';
import {RequestOptions} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {
  trackIntegrationEvent,
  getIntegrationFeatureGate,
} from 'app/utils/integrationUtil';
import space from 'app/styles/space';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';
import Button from 'app/components/button';
import Alert, {Props as AlertProps} from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';
import InstalledIntegration from 'app/views/organizationIntegrations/installedIntegration';
import marked, {singleLineRenderer} from 'app/utils/marked';
import withOrganization from 'app/utils/withOrganization';
import {sortArray} from 'app/utils';
import AbstractIntegrationDetailedView from './abstractIntegrationDetailedView';

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

  get provider() {
    return this.state.information.providers[0];
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
    return this.provider.metadata.features;
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
    const [domainName, orgName] = integration.domainName.split('/');

    if (integration.accountType === 'User') {
      url = `https://${domainName}/settings/installations/`;
    } else {
      url = `https://${domainName}/organizations/${orgName}/settings/installations/`;
    }

    window.open(url, '_blank');
  };

  handleExternalInstall = () => {
    const {organization} = this.props;
    const provider = this.provider;
    trackIntegrationEvent(
      {
        eventKey: 'integrations.installation_start',
        eventName: 'Integrations: Installation Start',
        integration: provider.key,
        integration_type: 'first_party',
      },
      organization
    );
  };

  renderTopButton(disabled: boolean) {
    const {organization} = this.props;
    const provider = this.provider;
    const {metadata} = provider;

    const size = 'small' as const;
    const priority = 'primary' as const;

    const buttonProps = {
      style: {marginLeft: space(1)},
      size,
      priority,
      'data-test-id': 'add-button',
      disabled,
      organization,
    };

    if (provider.canAdd) {
      return (
        <AddIntegrationButton
          provider={provider}
          onAddIntegration={this.onInstall}
          {...buttonProps}
        />
      );
    }
    if (metadata.aspects.externalInstall) {
      return (
        <Button
          icon="icon-exit"
          href={metadata.aspects.externalInstall.url}
          onClick={this.handleExternalInstall}
          external
          {...buttonProps}
        >
          {metadata.aspects.externalInstall.buttonText}
        </Button>
      );
    }
    //should never happen but we can't return undefined without some refactoring
    return <span />;
  }

  renderBody() {
    const {configurations, tab} = this.state;
    const provider = this.provider;
    const {organization} = this.props;

    const {metadata} = provider;
    const alerts = metadata.aspects.alerts || [];

    if (!provider.canAdd && metadata.aspects.externalInstall) {
      alerts.push({
        type: 'warning',
        icon: 'icon-exit',
        text: metadata.aspects.externalInstall.noticeText,
      });
    }

    // Prepare the features list
    const features = metadata.features.map(f => ({
      featureGate: f.featureGate,
      description: (
        <FeatureListItem
          dangerouslySetInnerHTML={{__html: singleLineRenderer(f.description)}}
        />
      ),
    }));

    const {FeatureList} = getIntegrationFeatureGate();
    const featureProps = {organization, features};
    return (
      <React.Fragment>
        {this.renderTopSection()}
        {this.renderTabs()}
        {tab === 'information' ? (
          <InformationCard alerts={alerts} provider={provider}>
            <FeatureList {...featureProps} provider={provider} />
          </InformationCard>
        ) : (
          <div>
            {configurations.map(integration => (
              <InstallWrapper key={integration.id}>
                <InstalledIntegration
                  organization={organization}
                  provider={provider}
                  integration={integration}
                  onRemove={this.onRemove}
                  onDisable={this.onDisable}
                  onReinstallIntegration={this.onInstall}
                  data-test-id={integration.id}
                />
              </InstallWrapper>
            ))}
          </div>
        )}
      </React.Fragment>
    );
  }
}

const Flex = styled('div')`
  display: flex;
`;

const Description = styled('div')`
  font-size: 1.5rem;
  line-height: 2.1rem;
  margin-bottom: ${space(2)};

  li {
    margin-bottom: 6px;
  }
`;

const Metadata = styled(Flex)`
  font-size: 0.9em;
  margin-bottom: ${space(2)};

  a {
    margin-left: ${space(1)};
  }
`;

const AuthorName = styled('div')`
  color: ${p => p.theme.gray2};
  flex: 1;
`;

const FeatureListItem = styled('span')`
  line-height: 24px;
`;

const InstallWrapper = styled('div')`
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.borderLight};
`;

const InformationCard = ({children, alerts, provider}: InformationCardProps) => {
  const {metadata} = provider;
  const description = marked(metadata.description);
  return (
    <React.Fragment>
      <Description dangerouslySetInnerHTML={{__html: description}} />
      {children}
      <Metadata>
        <AuthorName>{t('By %s', provider.metadata.author)}</AuthorName>
        <div>
          <ExternalLink href={metadata.source_url}>{t('View Source')}</ExternalLink>
          <ExternalLink href={metadata.issue_url}>{t('Report Issue')}</ExternalLink>
        </div>
      </Metadata>

      {alerts.map((alert, i) => (
        <Alert key={i} type={alert.type} icon={alert.icon}>
          <span dangerouslySetInnerHTML={{__html: singleLineRenderer(alert.text)}} />
        </Alert>
      ))}
    </React.Fragment>
  );
};

type InformationCardProps = {
  children: React.ReactNode;
  alerts: any | AlertType[];
  provider: IntegrationProvider;
};

type AlertType = AlertProps & {
  text: string;
};

export default withOrganization(IntegrationDetailedView);
