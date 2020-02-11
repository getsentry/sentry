import React from 'react';
import styled from '@emotion/styled';
import {RouteComponentProps} from 'react-router/lib/Router';

import {
  Organization,
  PluginWithProjectList,
  PluginNoProject,
  PluginProjectItem,
} from 'app/types';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import AsyncComponent from 'app/components/asyncComponent';
import PluginIcon from 'app/plugins/components/pluginIcon';
import Tag from 'app/views/settings/components/tag';
import Access from 'app/components/acl/access';
import Tooltip from 'app/components/tooltip';
import Button from 'app/components/button';
import InlineSvg from 'app/components/inlineSvg';
import ExternalLink from 'app/components/links/externalLink';
import InstalledPlugin from 'app/views/organizationIntegrations/installedPlugin';
import {openModal} from 'app/actionCreators/modal';
import ContextPickerModal from 'app/components/contextPickerModal';
import {getIntegrationFeatureGate} from 'app/utils/integrationUtil';
import {t} from 'app/locale';
import IntegrationStatus from './integrationStatus';

type Tab = 'information' | 'configurations';
const tabs: Tab[] = ['information', 'configurations'];

type State = {
  plugins: PluginWithProjectList[];
  tab: Tab;
};

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string; pluginSlug: string}, {}>;

class PluginDetailedView extends AsyncComponent<
  Props & AsyncComponent['props'],
  State & AsyncComponent['state']
> {
  componentDidMount() {
    const {location} = this.props;
    const value =
      location.query.tab === 'configurations' ? 'configurations' : 'information';

    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState({tab: value});
  }

  getEndpoints(): ([string, string, any] | [string, string])[] {
    const {orgId, pluginSlug} = this.props.params;
    return [
      ['plugins', `/organizations/${orgId}/plugins/configs/?plugins=${pluginSlug}`],
    ];
  }
  get plugin() {
    return this.state.plugins[0];
  }

  get isEnabled() {
    return this.state.plugins[0].projectList.length > 0;
  }

  get status() {
    return this.isEnabled ? 'Installed' : 'Not Installed';
  }

  handleResetConfiguration = (projectId: string) => {
    //make a copy of our project list
    const projectList = this.plugin.projectList.slice();
    //find the index of the project
    const index = projectList.findIndex(item => item.projectId === projectId);
    //should match but quit if it doesn't
    if (index < 0) {
      return;
    }
    //remove from array
    projectList.splice(index, 1);
    //update state
    this.setState({
      plugins: [{...this.state.plugins[0], projectList}],
    });
  };

  handleEnablePlugin = (projectId: string) => {
    //make a copy of our project list
    const projectList = this.plugin.projectList.slice();
    //find the index of the project
    const index = projectList.findIndex(item => item.projectId === projectId);
    //should match but quit if it doesn't
    if (index < 0) {
      return;
    }

    //update item in array
    projectList[index] = {
      ...projectList[index],
      enabled: true,
    };

    //update state
    this.setState({
      plugins: [{...this.state.plugins[0], projectList}],
    });
  };

  handleAddToProject = () => {
    const plugin = this.plugin;
    const {organization, router} = this.props;
    openModal(
      ({closeModal, Header, Body}) => (
        <ContextPickerModal
          Header={Header}
          Body={Body}
          nextPath={`/settings/${organization.slug}/projects/:projectId/plugins/${plugin.id}/`}
          needProject
          needOrg={false}
          onFinish={path => {
            closeModal();
            router.push(path);
          }}
        />
      ),
      {}
    );
  };

  onTabChange = (value: Tab) => {
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

  getTabDiplay(tab: Tab) {
    //we want to show project configurations to make it more clear
    if (tab === 'configurations') {
      return 'project configurations';
    }
    return tab;
  }

  renderBody() {
    const plugin = this.plugin;
    const {tab} = this.state;
    const {organization} = this.props;

    // Prepare the features list
    const features = plugin.featureDescriptions.map(f => ({
      featureGate: f.featureGate,
      description: <FeatureListItem>{f.description}</FeatureListItem>,
    }));

    const {FeatureList, IntegrationFeatures} = getIntegrationFeatureGate();
    const featureProps = {organization, features};

    return (
      <React.Fragment>
        <Flex>
          <PluginIcon size={60} pluginId={plugin.slug} />
          <TitleContainer>
            <Flex>
              <Title>{plugin.name}</Title>
              <Status status={this.status} />
            </Flex>
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
                        onClick={this.handleAddToProject}
                        size="small"
                        priority="primary"
                      >
                        {t('Add to Project')}
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
              <a style={{textTransform: 'capitalize'}}>{t(this.getTabDiplay(tabName))}</a>
            </li>
          ))}
        </ul>
        {tab === 'information' ? (
          <InformationCard plugin={plugin}>
            <FeatureList {...featureProps} provider={this.mapPluginToProvider()} />
          </InformationCard>
        ) : (
          <div>
            {plugin.projectList.map((projectItem: PluginProjectItem) => (
              <InstalledPlugin
                key={projectItem.projectId}
                organization={organization}
                plugin={plugin}
                projectItem={projectItem}
                onResetConfiguration={this.handleResetConfiguration}
                onEnablePlugin={this.handleEnablePlugin}
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

const AddButton = styled(Button)`
  margin-left: ${space(1)};
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

const StatusWrapper = styled('div')`
  margin-bottom: ${space(1)};
  padding-left: ${space(2)};
  line-height: 1.5em;
`;

const Status = p => (
  <StatusWrapper>
    <IntegrationStatus {...p} />
  </StatusWrapper>
);

type InformationCardProps = {
  children: React.ReactNode;
  plugin: PluginNoProject;
};

const InformationCard = ({children, plugin}: InformationCardProps) => {
  return (
    <React.Fragment>
      <Description>{plugin.description}</Description>
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

export default withOrganization(PluginDetailedView);
