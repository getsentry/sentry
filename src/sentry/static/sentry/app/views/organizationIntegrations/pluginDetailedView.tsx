import React from 'react';
import styled from '@emotion/styled';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Organization, PluginWithProjectList, PluginNoProject} from 'app/types';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import AsyncComponent from 'app/components/asyncComponent';
import PluginIcon from 'app/plugins/components/pluginIcon';
import Tag from 'app/views/settings/components/tag';
import HookStore from 'app/stores/hookStore';
import {Hooks} from 'app/types/hooks';
import marked, {singleLineRenderer} from 'app/utils/marked';
// import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';
import Access from 'app/components/acl/access';
import Tooltip from 'app/components/tooltip';
import Button from 'app/components/button';
import InlineSvg from 'app/components/inlineSvg';
import ExternalLink from 'app/components/links/externalLink';
// import Alert, {Props as AlertProps} from 'app/components/alert';
import {t} from 'app/locale';

// import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';
// import Button from 'app/components/button';
// import InlineSvg from 'app/components/inlineSvg';
// import InstalledIntegration, {
//   Props as InstalledIntegrationProps,
// } from 'app/views/organizationIntegrations/installedIntegration';
// import marked, {singleLineRenderer} from 'app/utils/marked';
// import {growDown, highlight} from 'app/styles/animations';

const defaultFeatureGateComponents = {
  IntegrationFeatures: p =>
    p.children({
      disabled: false,
      disabledReason: null,
      ungatedFeatures: p.features,
      gatedFeatureGroups: [],
    }),
  FeatureList: p => (
    <ul>
      {p.features.map((f, i) => (
        <li key={i}>{f.description}</li>
      ))}
    </ul>
  ),
} as ReturnType<Hooks['integrations:feature-gates']>;

type State = {
  plugins: PluginWithProjectList[];
  tab: string;
};

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string; pluginSlug: string}, {}>;

const tabs = ['information', 'configurations'];

class PluginDetailedView extends AsyncComponent<
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

  getEndpoints(): ([string, string, any] | [string, string])[] {
    const {orgId, pluginSlug} = this.props.params;
    const baseEndpoints: ([string, string, any] | [string, string])[] = [
      ['plugins', `/organizations/${orgId}/plugins/configs/?plugins=${pluginSlug}`],
    ];

    return baseEndpoints;
  }
  get plugin() {
    return this.state.plugins[0];
  }

  onInstall = () => {};

  onRemove = () => {};

  onDisable = () => {};

  handleExternalInstall = () => {};

  onTabChange = value => {
    this.setState({tab: value});
  };

  featureTags() {
    return this.plugin.features.map(feature => (
      <StyledTag key={feature}>{feature.replace(/-/g, ' ')}</StyledTag>
    ));
  }

  mapPluginToProvider() {
    const plugin = this.plugin;
    return {
      key: plugin.slug,
    };
  }

  renderConfigurationList() {
    return <React.Fragment></React.Fragment>;
  }

  renderBody() {
    const plugin = this.plugin;
    const {tab} = this.state;
    const {organization} = this.props;

    //TODO: Use sytled component
    const buttonProps = {
      style: {marginLeft: space(1)},
      size: 'small',
      priority: 'primary',
    };

    const AddButton = p => <Button {...buttonProps} {...p} />;

    // Prepare the features list
    const features = plugin.featureDescriptions.map(f => ({
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

    // const {tab} = this.state;
    return (
      <React.Fragment>
        <Flex>
          <PluginIcon size={60} pluginId={plugin.slug} />
          <TitleContainer>
            <Title>{plugin.name}</Title>
            <Flex>{this.featureTags()}</Flex>
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
                      >
                        {t('Add to project')}
                      </AddButton>
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
          <InformationCard plugin={plugin}>
            <FeatureList {...featureProps} provider={this.mapPluginToProvider()} />
          </InformationCard>
        ) : (
          this.renderConfigurationList()
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

const InformationCard = ({children, plugin}: InformationCardProps) => {
  const description = marked(plugin.description);
  return (
    <React.Fragment>
      <Description dangerouslySetInnerHTML={{__html: description}} />
      {children}
      <Metadata>
        {plugin.author && <AuthorName>{t('By %s', plugin.author.name)}</AuthorName>}
        <div>
          {/** TODO: May want to make resource links have same title as global integrations */}
          {plugin.resourceLinks &&
            plugin.resourceLinks.map(({title, url}) => (
              <ExternalLink key={url} href={url}>
                {title}
              </ExternalLink>
            ))}
        </div>
      </Metadata>
    </React.Fragment>
  );
};

type InformationCardProps = {
  children: React.ReactNode;
  plugin: PluginNoProject;
};

export default withOrganization(PluginDetailedView);
