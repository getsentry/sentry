import startCase from 'lodash/startCase';
import * as React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import Access from 'app/components/acl/access';
import Alert, {Props as AlertProps} from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import ExternalLink from 'app/components/links/externalLink';
import {Panel} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import {IconClose, IconDocs, IconGeneric, IconGithub, IconProject} from 'app/icons';
import {t} from 'app/locale';
import PluginIcon from 'app/plugins/components/pluginIcon';
import space from 'app/styles/space';
import {
  IntegrationFeature,
  IntegrationInstallationStatus,
  IntegrationType,
  Organization,
  SentryAppStatus,
} from 'app/types';
import {
  getCategories,
  getIntegrationFeatureGate,
  SingleIntegrationEvent,
  trackIntegrationEvent,
} from 'app/utils/integrationUtil';
import marked, {singleLineRenderer} from 'app/utils/marked';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Tag from 'app/components/tagDeprecated';

import IntegrationStatus from './integrationStatus';
import RequestIntegrationButton from './integrationRequest/RequestIntegrationButton';

type Tab = 'overview' | 'configurations';

type AlertType = AlertProps & {
  text: string;
};

type State = {
  tab: Tab;
} & AsyncComponent['state'];

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string; integrationSlug: string}, {}> &
  AsyncComponent['props'];

class AbstractIntegrationDetailedView<
  P extends Props = Props,
  S extends State = State
> extends AsyncComponent<P, S> {
  tabs: Tab[] = ['overview', 'configurations'];

  componentDidMount() {
    const {location} = this.props;
    const value = location.query.tab === 'configurations' ? 'configurations' : 'overview';
    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState({tab: value});
  }

  onLoadAllEndpointsSuccess() {
    this.trackIntegrationEvent({
      eventKey: 'integrations.integration_viewed',
      eventName: 'Integrations: Integration Viewed',
      integration_tab: this.state.tab,
    });
  }

  /***
   * Abstract methods defined below
   */

  //The analytics type used in analytics which is snake case
  get integrationType(): IntegrationType {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get description(): string {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get author(): string | undefined {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get alerts(): AlertType[] {
    //default is no alerts
    return [];
  }

  //Returns a list of the resources displayed at the bottom of the overview card
  get resourceLinks(): Array<{title: string; url: string}> {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get installationStatus(): IntegrationInstallationStatus | null {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get integrationName(): string {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  // Returns an array of RawIntegrationFeatures which is used in feature gating
  // and displaying what the integration does
  get featureData(): IntegrationFeature[] {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  getIcon(title: string) {
    switch (title) {
      case 'View Source':
        return <IconProject />;
      case 'Report Issue':
        return <IconGithub />;
      case 'Documentation':
      case 'Splunk Setup Instructions':
      case 'Trello Setup Instructions':
        return <IconDocs />;
      default:
        return <IconGeneric />;
    }
  }

  onTabChange = (value: Tab) => {
    this.trackIntegrationEvent({
      eventKey: 'integrations.integration_tab_clicked',
      eventName: 'Integrations: Integration Tab Clicked',
      integration_tab: value,
    });
    this.setState({tab: value});
  };

  //Returns the string that is shown as the title of a tab
  getTabDisplay(tab: Tab): string {
    //default is return the tab
    return tab;
  }

  //Render the button at the top which is usually just an installation button
  renderTopButton(
    _disabledFromFeatures: boolean, //from the feature gate
    _userHasAccess: boolean //from user permissions
  ): React.ReactElement {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  //Returns the permission descriptions, only use by Sentry Apps
  renderPermissions(): React.ReactElement | null {
    //default is don't render permissions
    return null;
  }

  renderEmptyConfigurations() {
    return (
      <Panel>
        <EmptyMessage
          title={t("You haven't set anything up yet")}
          description={t(
            'But that doesn’t have to be the case for long! Add an installation to get started.'
          )}
          action={this.renderAddInstallButton(true)}
        />
      </Panel>
    );
  }

  //Returns the list of configurations for the integration
  renderConfigurations() {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  /***
   * Actually implemented methods below
   */

  get integrationSlug() {
    return this.props.params.integrationSlug;
  }

  //Wrapper around trackIntegrationEvent that automatically provides many fields and the org
  trackIntegrationEvent = (
    options: Pick<
      SingleIntegrationEvent,
      'eventKey' | 'eventName' | 'integration_tab'
    > & {
      integration_status?: SentryAppStatus;
      project_id?: string;
    }
  ) => {
    //If we use this intermediate type we get type checking on the things we care about
    const params: Omit<
      Parameters<typeof trackIntegrationEvent>[0],
      'integrations_installed'
    > = {
      view: 'integrations_directory_integration_detail',
      integration: this.integrationSlug,
      integration_type: this.integrationType,
      already_installed: this.installationStatus !== 'Not Installed', //pending counts as installed here
      ...options,
    };
    //type cast here so TS won't complain
    const typeCasted = params as Parameters<typeof trackIntegrationEvent>[0];
    trackIntegrationEvent(typeCasted, this.props.organization);
  };

  //Returns the props as needed by the hooks integrations:feature-gates
  get featureProps() {
    const {organization} = this.props;
    const featureData = this.featureData;

    // Prepare the features list
    const features = featureData.map(f => ({
      featureGate: f.featureGate,
      description: (
        <FeatureListItem
          dangerouslySetInnerHTML={{__html: singleLineRenderer(f.description)}}
        />
      ),
    }));

    return {organization, features};
  }

  cleanTags() {
    return getCategories(this.featureData);
  }

  renderRequestIntegrationButton() {
    return (
      <RequestIntegrationButton
        organization={this.props.organization}
        name={this.integrationName}
        slug={this.integrationSlug}
        type={this.integrationType}
      />
    );
  }

  renderAddInstallButton(hideButtonIfDisabled = false) {
    const {organization} = this.props;
    const {IntegrationDirectoryFeatures} = getIntegrationFeatureGate();

    return (
      <IntegrationDirectoryFeatures {...this.featureProps}>
        {({disabled, disabledReason}) => (
          <DisableWrapper>
            <Access organization={organization} access={['org:integrations']}>
              {({hasAccess}) => (
                <Tooltip
                  title={t(
                    'You must be an organization owner, manager or admin to install this.'
                  )}
                  disabled={hasAccess}
                >
                  {!hideButtonIfDisabled && disabled ? (
                    <div />
                  ) : (
                    this.renderTopButton(disabled, hasAccess)
                  )}
                </Tooltip>
              )}
            </Access>
            {disabled && <DisabledNotice reason={disabledReason} />}
          </DisableWrapper>
        )}
      </IntegrationDirectoryFeatures>
    );
  }

  //Returns the content shown in the top section of the integration detail
  renderTopSection() {
    const tags = this.cleanTags();

    return (
      <Flex>
        <PluginIcon pluginId={this.integrationSlug} size={50} />
        <NameContainer>
          <Flex>
            <Name>{this.integrationName}</Name>
            <StatusWrapper>
              {this.installationStatus && (
                <IntegrationStatus status={this.installationStatus} />
              )}
            </StatusWrapper>
          </Flex>
          <Flex>
            {tags.map(feature => (
              <StyledTag key={feature}>{startCase(feature)}</StyledTag>
            ))}
          </Flex>
        </NameContainer>
        {this.renderAddInstallButton()}
      </Flex>
    );
  }

  //Returns the tabs divider with the clickable tabs
  renderTabs() {
    //TODO: Convert to styled component
    return (
      <ul className="nav nav-tabs border-bottom" style={{paddingTop: '30px'}}>
        {this.tabs.map(tabName => (
          <li
            key={tabName}
            className={this.state.tab === tabName ? 'active' : ''}
            onClick={() => this.onTabChange(tabName)}
          >
            <CapitalizedLink>{t(this.getTabDisplay(tabName))}</CapitalizedLink>
          </li>
        ))}
      </ul>
    );
  }

  //Returns the information about the integration description and features
  renderInformationCard() {
    const {IntegrationDirectoryFeatureList} = getIntegrationFeatureGate();

    return (
      <React.Fragment>
        <Flex>
          <FlexContainer>
            <Description dangerouslySetInnerHTML={{__html: marked(this.description)}} />
            <IntegrationDirectoryFeatureList
              {...this.featureProps}
              provider={{key: this.props.params.integrationSlug}}
            />
            {this.renderPermissions()}
            {this.alerts.map((alert, i) => (
              <Alert key={i} type={alert.type} icon={alert.icon}>
                <span
                  dangerouslySetInnerHTML={{__html: singleLineRenderer(alert.text)}}
                />
              </Alert>
            ))}
          </FlexContainer>
          <Metadata>
            {!!this.author && (
              <AuthorInfo>
                <CreatedContainer>{t('Created By')}</CreatedContainer>
                <div>{this.author}</div>
              </AuthorInfo>
            )}
            {this.resourceLinks.map(({title, url}) => (
              <ExternalLinkContainer key={url}>
                {this.getIcon(title)}
                <ExternalLink href={url}>{t(title)}</ExternalLink>
              </ExternalLinkContainer>
            ))}
          </Metadata>
        </Flex>
      </React.Fragment>
    );
  }

  renderBody() {
    return (
      <React.Fragment>
        {this.renderTopSection()}
        {this.renderTabs()}
        {this.state.tab === 'overview'
          ? this.renderInformationCard()
          : this.renderConfigurations()}
      </React.Fragment>
    );
  }
}

const Flex = styled('div')`
  display: flex;
`;

const FlexContainer = styled('div')`
  flex: 1;
`;

const CapitalizedLink = styled('a')`
  text-transform: capitalize;
`;

const StyledTag = styled(Tag)`
  text-transform: none;
  &:not(:first-child) {
    margin-left: ${space(0.5)};
  }
`;

const NameContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
  padding-left: ${space(2)};
`;

const Name = styled('div')`
  font-weight: bold;
  font-size: 1.4em;
  margin-bottom: ${space(1)};
`;

const IconCloseCircle = styled(IconClose)`
  color: ${p => p.theme.red400};
  margin-right: ${space(1)};
`;

const DisabledNotice = styled(({reason, ...p}: {reason: React.ReactNode}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
    }}
    {...p}
  >
    <IconCloseCircle isCircled />
    <span>{reason}</span>
  </div>
))`
  padding-top: ${space(0.5)};
  font-size: 0.9em;
`;

const FeatureListItem = styled('span')`
  line-height: 24px;
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
  display: grid;
  grid-auto-rows: max-content;
  grid-auto-flow: row;
  grid-gap: ${space(2)};
  font-size: 0.9em;
  margin-left: ${space(4)};
  margin-right: 100px;
`;

const AuthorInfo = styled('div')`
  margin-bottom: ${space(3)};
`;

const ExternalLinkContainer = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
  align-items: center;
`;

const StatusWrapper = styled('div')`
  margin-bottom: ${space(1)};
  padding-left: ${space(2)};
  line-height: 1.5em;
`;

const DisableWrapper = styled('div')`
  margin-left: auto;
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const CreatedContainer = styled('div')`
  text-transform: uppercase;
  padding-bottom: ${space(1)};
  color: ${p => p.theme.gray500};
  font-weight: 600;
  font-size: 12px;
`;

export default AbstractIntegrationDetailedView;
