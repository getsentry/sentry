import {Fragment} from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import Access from 'sentry/components/acl/access';
import type {AlertProps} from 'sentry/components/core/alert';
import {Alert} from 'sentry/components/core/alert';
import Tag from 'sentry/components/core/badge/tag';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClose, IconDocs, IconGeneric, IconGithub, IconProject} from 'sentry/icons';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {
  IntegrationFeature,
  IntegrationInstallationStatus,
  IntegrationType,
} from 'sentry/types/integrations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {
  IntegrationAnalyticsKey,
  IntegrationEventParameters,
} from 'sentry/utils/analytics/integrations';
import {
  getCategories,
  getIntegrationFeatureGate,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import marked, {singleLineRenderer} from 'sentry/utils/marked';
import BreadcrumbTitle from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';

import RequestIntegrationButton from './integrationRequest/RequestIntegrationButton';
import IntegrationStatus from './integrationStatus';

export type Tab = 'overview' | 'configurations' | 'features';

interface AlertType extends AlertProps {
  text: string;
}

type State = {
  tab: Tab;
} & DeprecatedAsyncComponent['state'];

type Props = {
  organization: Organization;
} & RouteComponentProps<{integrationSlug: string}> &
  DeprecatedAsyncComponent['props'];

abstract class AbstractIntegrationDetailedView<
  P extends Props = Props,
  S extends State = State,
> extends DeprecatedAsyncComponent<P, S> {
  tabs: Tab[] = ['overview', 'configurations'];

  componentDidMount() {
    super.componentDidMount();
    const {location} = this.props;
    const value = location.query.tab === 'configurations' ? 'configurations' : 'overview';

    this.setState({tab: value});
  }

  onLoadAllEndpointsSuccess() {
    this.trackIntegrationAnalytics('integrations.integration_viewed', {
      integration_tab: this.state.tab,
    });
  }

  /**
   * Abstract methods defined below
   */

  // The analytics type used in analytics which is snake case
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
    // default is no alerts
    return [];
  }

  // Returns a list of the resources displayed at the bottom of the overview card
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

  // Checks to see if integration requires admin access to install, doc integrations don't
  get requiresAccess(): boolean {
    // default is integration requires access to install
    return true;
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
    this.trackIntegrationAnalytics('integrations.integration_tab_clicked', {
      integration_tab: value,
    });
    this.setState({tab: value});
  };

  // Returns the string that is shown as the title of a tab
  getTabDisplay(tab: Tab): string {
    // default is return the tab
    return tab;
  }

  // Render the button at the top which is usually just an installation button
  renderTopButton(
    _disabledFromFeatures: boolean, // from the feature gate
    _userHasAccess: boolean // from user permissions
  ): React.ReactElement {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  // Returns the permission descriptions, only use by Sentry Apps
  renderPermissions(): React.ReactElement | null {
    // default is don't render permissions
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

  // Returns the list of configurations for the integration
  abstract renderConfigurations(): React.ReactNode;

  /**
   * Actually implemented methods below
   */

  get integrationSlug() {
    return this.props.params.integrationSlug;
  }

  // Wrapper around trackIntegrationAnalytics that automatically provides many fields and the org
  trackIntegrationAnalytics = <T extends IntegrationAnalyticsKey>(
    eventKey: IntegrationAnalyticsKey,
    options?: Partial<IntegrationEventParameters[T]>
  ) => {
    options = options || {};
    // If we use this intermediate type we get type checking on the things we care about
    trackIntegrationAnalytics(eventKey, {
      view: 'integrations_directory_integration_detail',
      integration: this.integrationSlug,
      integration_type: this.integrationType,
      already_installed: this.installationStatus !== 'Not Installed', // pending counts as installed here
      organization: this.props.organization,
      ...options,
    });
  };

  // Returns the props as needed by the hooks integrations:feature-gates
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

  renderAlert(): React.ReactNode {
    return null;
  }

  renderAdditionalCTA(): React.ReactNode {
    return null;
  }

  renderIntegrationIcon() {
    return <PluginIcon pluginId={this.integrationSlug} size={50} />;
  }

  renderRequestIntegrationButton() {
    return (
      <RequestIntegrationButton
        name={this.integrationName}
        slug={this.integrationSlug}
        type={this.integrationType}
      />
    );
  }

  renderAddInstallButton(hideButtonIfDisabled = false) {
    const {IntegrationFeatures} = getIntegrationFeatureGate();

    return (
      <IntegrationFeatures {...this.featureProps}>
        {({disabled, disabledReason}) => (
          <DisableWrapper>
            <Access access={['org:integrations']}>
              {({hasAccess}) => (
                <Tooltip
                  title={t(
                    'You must be an organization owner, manager or admin to install this.'
                  )}
                  disabled={hasAccess || !this.requiresAccess}
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
      </IntegrationFeatures>
    );
  }

  // Returns the content shown in the top section of the integration detail
  renderTopSection() {
    const tags = this.cleanTags();

    return (
      <TopSectionWrapper>
        <Flex>
          {this.renderIntegrationIcon()}
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
        </Flex>
        <Flex>
          {this.renderAddInstallButton()}
          {this.renderAdditionalCTA()}
        </Flex>
      </TopSectionWrapper>
    );
  }

  // Returns the tabs divider with the clickable tabs
  renderTabs() {
    // TODO: Convert to styled component
    return (
      <ul className="nav nav-tabs border-bottom" style={{paddingTop: '30px'}}>
        {this.tabs.map(tabName => (
          <li
            key={tabName}
            className={this.state.tab === tabName ? 'active' : ''}
            onClick={() => this.onTabChange(tabName)}
          >
            <CapitalizedLink>{this.getTabDisplay(tabName)}</CapitalizedLink>
          </li>
        ))}
      </ul>
    );
  }

  // Returns the information about the integration description and features
  renderInformationCard() {
    const {FeatureList} = getIntegrationFeatureGate();

    return (
      <Fragment>
        <Flex>
          <FlexContainer>
            <Description dangerouslySetInnerHTML={{__html: marked(this.description)}} />
            <FeatureList
              {...this.featureProps}
              provider={{key: this.props.params.integrationSlug}}
            />
            {this.renderPermissions()}
            {this.alerts.map((alert, i) => (
              <Alert.Container key={i}>
                <Alert key={i} type={alert.type} showIcon>
                  <span
                    dangerouslySetInnerHTML={{__html: singleLineRenderer(alert.text)}}
                  />
                </Alert>
              </Alert.Container>
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
                <ExternalLink href={url}>{title}</ExternalLink>
              </ExternalLinkContainer>
            ))}
          </Metadata>
        </Flex>
      </Fragment>
    );
  }

  renderBody() {
    return (
      <Fragment>
        <BreadcrumbTitle routes={this.props.routes} title={this.integrationName} />
        {this.renderAlert()}
        {this.renderTopSection()}
        {this.renderTabs()}
        {this.state.tab === 'overview'
          ? this.renderInformationCard()
          : this.renderConfigurations()}
      </Fragment>
    );
  }
}

const Flex = styled('div')`
  display: flex;
  align-items: center;
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
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: 1.4em;
  margin-bottom: ${space(0.5)};
`;

const IconCloseCircle = styled(IconClose)`
  color: ${p => p.theme.dangerText};
  margin-right: ${space(1)};
`;

export const DisabledNotice = styled(({reason, ...p}: {reason: React.ReactNode}) => (
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
  li {
    margin-bottom: 6px;
  }
`;

const Metadata = styled(Flex)`
  display: grid;
  grid-auto-rows: max-content;
  grid-auto-flow: row;
  gap: ${space(1)};
  font-size: 0.9em;
  margin-left: ${space(4)};
  margin-right: 100px;
  align-self: flex-start;
`;

const AuthorInfo = styled('div')`
  margin-bottom: ${space(3)};
`;

const ExternalLinkContainer = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
`;

const StatusWrapper = styled('div')`
  margin-bottom: ${space(0.5)};
  padding-left: ${space(2)};
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
  color: ${p => p.theme.gray300};
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: 12px;
`;

const TopSectionWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
`;

export default AbstractIntegrationDetailedView;
