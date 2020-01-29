import React from 'react';
import styled from '@emotion/styled';

import {Organization, Integration, IntegrationProvider, RouterProps} from 'app/types';
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
import Alert from 'app/components/alert';
import Tooltip from 'app/components/tooltip';
import InlineSvg from 'app/components/inlineSvg';
import ExternalLink from 'app/components/links/externalLink';
import marked, {singleLineRenderer} from 'app/utils/marked';
import HookStore from 'app/stores/hookStore';
import withOrganization from 'app/utils/withOrganization';

type State = {
  configurations: Integration[];
  provider: {information: IntegrationProvider};
  tab: string;
};

type Props = RouterProps & {
  organization: Organization;
};

const defaultFeatureGateComponents = {
  IntegrationFeatures: p =>
    p.children({
      disabled: false,
      disabledReason: null,
      ungatedFeatures: p.features,
      gatedFeatureGroups: [],
    }),
  FeatureList: p => {
    console.log({p});

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
    let value = location?.query?.tab ? (location.query.tab as string) : 'information';
    this.setState({
      tab: value,
    });
  }

  getEndpoints(): ([string, string, any] | [string, string])[] {
    const {orgId, providerKey} = this.props.params;
    const baseEndpoints: ([string, string, any] | [string, string])[] = [
      [
        'provider',
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

  onAddIntegration = () => {};

  handleExternalInstall = () => {
    const {organization} = this.props;
    const {provider} = this.state;
    trackIntegrationEvent(
      {
        eventKey: 'integrations.installation_start',
        eventName: 'Integrations: Installation Start',
        integration: provider.information.key,
        integration_type: 'first_party',
      },
      organization
    );
  };

  onTabChange = value => {
    this.setState({tab: value});
  };

  renderBody() {
    console.log('state: ', this.state);
    const {
      provider: {information},
      //   configurations,
      //   tab,
    } = this.state;
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
          onAddIntegration={this.onAddIntegration}
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
    console.log('props: ', this.props);
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
              className={this.state.tab === tabName ? 'active' : ''}
              onClick={() => this.onTabChange(tabName)}
            >
              <a style={{textTransform: 'capitalize'}}>{tabName}</a>
            </li>
          ))}
        </ul>
        {this.state.tab === 'information' ? (
          <InformationCard alerts={alerts} information={information}>
            <FeatureList {...featureProps} provider={information} />
          </InformationCard>
        ) : (
          <div>Configs</div>
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
    <InlineSvg src="icon-circle-exclamation" size="1.5em" />
    <div style={{marginLeft: `${space(1)}`}}>{reason}</div>
  </div>
))`
  color: ${p => p.theme.red};
  font-size: 0.9em;
`;

const InformationCard = ({children, alerts, information}) => {
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
export default withOrganization(IntegrationDetailedView);
