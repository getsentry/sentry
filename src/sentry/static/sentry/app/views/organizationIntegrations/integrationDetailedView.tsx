import React from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Organization, Integration, IntegrationProvider} from 'app/types';
import {RequestOptions} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {Hooks} from 'app/types/hooks';
import {t} from 'app/locale';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';
import AsyncComponent from 'app/components/asyncComponent';
import PluginIcon from 'app/plugins/components/pluginIcon';
import space from 'app/styles/space';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';
import Access from 'app/components/acl/access';
import Tag from 'app/views/settings/components/tag';
import Button from 'app/components/button';
import Alert, {Props as AlertProps} from 'app/components/alert';
import Tooltip from 'app/components/tooltip';
import {IconWarning} from 'app/icons';
import ExternalLink from 'app/components/links/externalLink';
import InstalledIntegration, {
  Props as InstalledIntegrationProps,
} from 'app/views/organizationIntegrations/installedIntegration';
import marked, {singleLineRenderer} from 'app/utils/marked';
import HookStore from 'app/stores/hookStore';
import withOrganization from 'app/utils/withOrganization';
import {growDown, highlight} from 'app/styles/animations';
import {sortArray} from 'app/utils';

type State = {
  configurations: Integration[];
  information: {providers: IntegrationProvider[]};
  tab: string;
  newlyInstalledIntegrationId: string;
};

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string; providerKey: string}, {}>;

const defaultFeatureGateComponents = {
  IntegrationFeatures: p =>
    p.children({
      disabled: false,
      disabledReason: null,
      ungatedFeatures: p.features,
      gatedFeatureGroups: [],
    }),
  FeatureList: p => {
    return (
      <ul>
        {p.features.map((f, i) => (
          <li key={i}>{f.description}</li>
        ))}
      </ul>
    );
  },
} as ReturnType<Hooks['integrations:feature-gates']>;

const tabs = ['information', 'configurations'];

class IntegrationDetailedView extends AsyncComponent<
  Props & AsyncComponent['props'],
  State & AsyncComponent['state']
> {
  componentDidMount() {
    const {location} = this.props;
    const value =
      typeof location.query.tab === 'string' ? location.query.tab : 'information';

    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState({tab: value});
  }

  getInformation() {
    return this.state.information.providers[0];
  }

  getEndpoints(): ([string, string, any] | [string, string])[] {
    const {orgId, providerKey} = this.props.params;
    const baseEndpoints: ([string, string, any] | [string, string])[] = [
      [
        'information',
        `/organizations/${orgId}/config/integrations/?provider_key=${providerKey}`,
      ],
      [
        'configurations',
        `/organizations/${orgId}/integrations/?provider_key=${providerKey}`,
      ],
    ];

    return baseEndpoints;
  }

  featureTags(features: string[]) {
    return features.map(feature => (
      <StyledTag key={feature}>{feature.replace(/-/g, ' ')}</StyledTag>
    ));
  }

  onInstall = (integration: Integration) => {
    // Merge the new integration into the list. If we're updating an
    // integration overwrite the old integration.
    const keyedItems = keyBy(this.state.configurations, i => i.id);

    // Mark this integration as newlyAdded if it didn't already exist, allowing
    // us to animate the element in.
    if (!keyedItems.hasOwnProperty(integration.id)) {
      this.setState({newlyInstalledIntegrationId: integration.id});
    }

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
    this.setState({integrations});

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
    const information = this.getInformation();
    trackIntegrationEvent(
      {
        eventKey: 'integrations.installation_start',
        eventName: 'Integrations: Installation Start',
        integration: information.key,
        integration_type: 'first_party',
      },
      organization
    );
  };

  onTabChange = value => {
    this.setState({tab: value});
  };

  renderBody() {
    const {configurations, tab} = this.state;
    const information = this.getInformation();
    const {organization} = this.props;

    const {metadata} = information;
    const alerts = metadata.aspects.alerts || [];

    if (!information.canAdd && metadata.aspects.externalInstall) {
      alerts.push({
        type: 'warning',
        icon: 'icon-exit',
        text: metadata.aspects.externalInstall.noticeText,
      });
    }

    const buttonProps = {
      style: {marginLeft: space(1)},
      size: 'small',
      priority: 'primary',
    };

    const AddButton = p =>
      (information.canAdd && (
        <AddIntegrationButton
          provider={information}
          onAddIntegration={this.onInstall}
          {...buttonProps}
          {...p}
        />
      )) ||
      (!information.canAdd && metadata.aspects.externalInstall && (
        <Button
          icon="icon-exit"
          href={metadata.aspects.externalInstall.url}
          onClick={this.handleExternalInstall}
          external
          {...buttonProps}
          {...p}
        >
          {metadata.aspects.externalInstall.buttonText}
        </Button>
      ));

    // Prepare the features list
    const features = metadata.features.map(f => ({
      featureGate: f.featureGate,
      description: (
        <FeatureListItem
          dangerouslySetInnerHTML={{__html: singleLineRenderer(f.description)}}
        />
      ),
    }));

    const featureListHooks = HookStore.get('integrations:feature-gates');
    featureListHooks.push(() => defaultFeatureGateComponents);

    const {FeatureList, IntegrationFeatures} = featureListHooks[0]();
    const featureProps = {organization, features};
    return (
      <React.Fragment>
        <Flex>
          <PluginIcon size={60} pluginId={information.key} />
          <TitleContainer>
            <Title>{information.name}</Title>
            <Flex>
              {information.features.length && this.featureTags(information.features)}
            </Flex>
          </TitleContainer>

          <IntegrationFeatures {...featureProps}>
            {({disabled, disabledReason}) => (
              <div
                style={{
                  marginLeft: 'auto',
                  alignSelf: 'center',
                }}
              >
                {disabled && <DisabledNotice reason={disabledReason} />}
                <Access organization={organization} access={['org:integrations']}>
                  {({hasAccess}) => (
                    <Tooltip
                      title={t(
                        'You must be an organization owner, manager or admin to install this.'
                      )}
                      disabled={hasAccess}
                    >
                      <AddButton
                        data-test-id="add-button"
                        disabled={disabled || !hasAccess}
                        organization={organization}
                      />
                    </Tooltip>
                  )}
                </Access>
              </div>
            )}
          </IntegrationFeatures>
        </Flex>
        <ul className="nav nav-tabs border-bottom" style={{paddingTop: '30px'}}>
          {tabs.map(tabName => (
            <li
              key={tabName}
              className={tab === tabName ? 'active' : ''}
              onClick={() => this.onTabChange(tabName)}
            >
              <a style={{textTransform: 'capitalize'}}>{tabName}</a>
            </li>
          ))}
        </ul>
        {tab === 'information' ? (
          <InformationCard alerts={alerts} information={information}>
            <FeatureList {...featureProps} provider={information} />
          </InformationCard>
        ) : (
          <div>
            {configurations.map(integration => (
              <StyledInstalledIntegration
                key={integration.id}
                organization={organization}
                provider={information}
                integration={integration}
                onRemove={this.onRemove}
                onDisable={this.onDisable}
                onReinstallIntegration={this.onInstall}
                data-test-id={integration.id}
                newlyAdded={integration.id === this.state.newlyInstalledIntegrationId}
              />
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

const Title = styled('div')`
  font-weight: bold;
  font-size: 1.4em;
  margin-bottom: ${space(1)};
`;

const TitleContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
  padding-left: ${space(2)};
`;

const StyledTag = styled(Tag)`
  &:not(:first-child) {
    margin-left: ${space(0.5)};
  }
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

const DisabledNotice = styled(({reason, ...p}: {reason: React.ReactNode}) => (
  <div
    style={{
      flex: 1,
      alignItems: 'center',
    }}
    {...p}
  >
    <IconWarning size="lg" />
    <div style={{marginLeft: `${space(1)}`}}>{reason}</div>
  </div>
))`
  color: ${p => p.theme.red};
  font-size: 0.9em;
`;

const NewInstallation = styled('div')`
  overflow: hidden;
  transform-origin: 0 auto;
  animation: ${growDown('59px')} 160ms 500ms ease-in-out forwards,
    ${p => highlight(p.theme.yellowLightest)} 1000ms 500ms ease-in-out forwards;
`;

const StyledInstalledIntegration = styled(
  (p: InstalledIntegrationProps & {newlyAdded: boolean}) =>
    p.newlyAdded ? (
      <NewInstallation>
        <InstalledIntegration {...p} />
      </NewInstallation>
    ) : (
      <InstalledIntegration {...p} />
    )
)`
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.borderLight};
`;

const InformationCard = ({children, alerts, information}: InformationCardProps) => {
  const {metadata} = information;
  const description = marked(metadata.description);
  return (
    <React.Fragment>
      <Description dangerouslySetInnerHTML={{__html: description}} />
      {children}
      <Metadata>
        <AuthorName>{t('By %s', information.metadata.author)}</AuthorName>
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
  information: IntegrationProvider;
};

type AlertType = AlertProps & {
  text: string;
};

export default withOrganization(IntegrationDetailedView);
