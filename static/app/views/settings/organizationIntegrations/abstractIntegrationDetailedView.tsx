import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
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
import {getCategories, trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import IntegrationLayout, {
  type AlertType,
  type IntegrationTab,
} from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';

import RequestIntegrationButton from './integrationRequest/RequestIntegrationButton';

type State = {
  tab: IntegrationTab;
} & DeprecatedAsyncComponent['state'];

type Props = {
  organization: Organization;
} & RouteComponentProps<{integrationSlug: string}> &
  DeprecatedAsyncComponent['props'];

abstract class AbstractIntegrationDetailedView<
  P extends Props = Props,
  S extends State = State,
> extends DeprecatedAsyncComponent<P, S> {
  tabs: IntegrationTab[] = ['overview', 'configurations'];

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

  onTabChange = (value: IntegrationTab) => {
    this.trackIntegrationAnalytics('integrations.integration_tab_clicked', {
      integration_tab: value,
    });
    this.setState({tab: value});
  };

  // Returns the string that is shown as the title of a tab
  getTabDisplay(tab: IntegrationTab): string {
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
      <IntegrationLayout.EmptyConfigurations action={this.renderAddInstallButton(true)} />
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
    return (
      <IntegrationLayout.AddInstallButton
        featureData={this.featureData}
        hideButtonIfDisabled={hideButtonIfDisabled}
        requiresAccess={this.requiresAccess}
        renderTopButton={(disabledFromFeatures, userHasAccess) =>
          this.renderTopButton(disabledFromFeatures, userHasAccess)
        }
      />
    );
  }

  // Returns the content shown in the top section of the integration detail
  renderTopSection() {
    return (
      <IntegrationLayout.TopSection
        featureData={this.featureData}
        integrationName={this.integrationName}
        installationStatus={this.installationStatus}
        integrationIcon={this.renderIntegrationIcon()}
        addInstallButton={this.renderAddInstallButton()}
        additionalCTA={this.renderAdditionalCTA()}
      />
    );
  }

  // Returns the tabs divider with the clickable tabs
  renderTabs() {
    return (
      <IntegrationLayout.Tabs
        tabs={this.tabs}
        activeTab={this.state.tab}
        onTabChange={this.onTabChange}
        getTabDisplay={this.getTabDisplay}
      />
    );
  }

  // Returns the information about the integration description and features
  renderInformationCard() {
    return (
      <IntegrationLayout.InformationCard
        integrationSlug={this.integrationSlug}
        description={this.description}
        alerts={this.alerts}
        featureData={this.featureData}
        author={this.author}
        resourceLinks={this.resourceLinks}
        permissions={this.renderPermissions()}
      />
    );
  }

  renderBody() {
    return (
      <IntegrationLayout.Body
        integrationName={this.integrationName}
        alert={this.renderAlert()}
        topSection={this.renderTopSection()}
        tabs={this.renderTabs()}
        content={
          this.state.tab === 'overview'
            ? this.renderInformationCard()
            : this.renderConfigurations()
        }
      />
    );
  }
}

export default AbstractIntegrationDetailedView;
