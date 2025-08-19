import {lazy} from 'react';

import LazyLoad from 'sentry/components/lazyLoad';
import {IconBusiness} from 'sentry/icons';
import HookStore from 'sentry/stores/hookStore';
import type {Hooks} from 'sentry/types/hooks';

import {shouldExcludeOrg} from 'getsentry/components/superuser/superuserWarning';
import hookAnalyticsInitUser from 'getsentry/hooks/analyticsInitUser';
import handleGuideUpdate from 'getsentry/hooks/handleGuideUpdate';
import {handleMonitorCreated} from 'getsentry/hooks/handleMonitorCreated';
import hookIntegrationFeatures from 'getsentry/hooks/integrationFeatures';
import legacyOrganizationRedirectRoutes from 'getsentry/hooks/legacyOrganizationRedirectRoutes';
import {getOrgRoles} from 'getsentry/hooks/organizationRoles';
import hookRootRoutes from 'getsentry/hooks/rootRoutes';
import hookSettingsRoutes from 'getsentry/hooks/settingsRoutes';
import hookSidebarDropdownMenu from 'getsentry/hooks/sidebarDropdownMenu';
import hookSidebarHelpMenu from 'getsentry/hooks/sidebarHelpMenu';
import rawTrackAnalyticsEvent from 'getsentry/utils/rawTrackAnalyticsEvent';
import trackMetric from 'getsentry/utils/trackMetric';

import useButtonTracking from './hooks/useButtonTracking';
import useGetMaxRetentionDays from './hooks/useGetMaxRetentionDays';
import useRouteActivatedHook from './hooks/useRouteActivatedHook';

// Lazy-loadable components below
const AiSetupDataConsentLazy = lazy(
  () => import('getsentry/components/ai/AiSetupDataConsent')
);
const CronsBillingBannerLazy = lazy(
  () => import('getsentry/components/crons/cronsBillingBanner')
);
const DashboardBannerLazy = lazy(() => import('getsentry/components/dashboardBanner'));
const DataConsentBannerLazy = lazy(
  () => import('getsentry/components/dataConsentBanner')
);
const DataConsentOrgCreationCheckboxLazy = lazy(
  () => import('getsentry/components/dataConsentCheckbox')
);
const DataConsentPriorityLearnMoreLazy = lazy(
  () => import('getsentry/components/dataConsentPriorityLearnMore')
);
const DisabledAlertWizardLazy = lazy(
  () => import('getsentry/components/features/disabledAlertWizard')
);
const DisabledAllProjectsSelectLazy = lazy(
  () => import('getsentry/components/features/disabledAllProjectsSelect')
);
const DisabledAuthProviderLazy = lazy(
  () => import('getsentry/components/features/disabledAuthProvider')
);
const DisabledCustomInboundFiltersLazy = lazy(
  () => import('getsentry/components/features/disabledCustomInboundFilters')
);
const DisabledDataForwardingLazy = lazy(
  () => import('getsentry/components/features/disabledDataForwarding')
);
const DisabledDateRangeLazy = lazy(
  () => import('getsentry/components/features/disabledDateRange')
);
const DisabledDiscardGroupLazy = lazy(
  () => import('getsentry/components/features/disabledDiscardGroup')
);
const DisabledQuickTraceLazy = lazy(
  () => import('getsentry/components/features/disabledQuickTrace')
);
const DisabledRateLimitsLazy = lazy(
  () => import('getsentry/components/features/disabledRateLimits')
);
const DisabledRelayLazy = lazy(
  () => import('getsentry/components/features/disabledRelay')
);
const DisabledSelectorItemsLazy = lazy(
  () => import('getsentry/components/features/disabledSelectorItems')
);
const ExploreDateRangeQueryLimitFooterLazy = lazy(
  () => import('getsentry/components/features/exploreDateRangeQueryLimitFooter')
);
const InsightsDateRangeQueryLimitFooterLazy = lazy(
  () => import('getsentry/components/features/insightsDateRangeQueryLimitFooter')
);
const InsightsUpsellPageLazy = lazy(
  () => import('getsentry/components/features/insightsUpsellPage')
);
const PerformanceNewProjectPromptLazy = lazy(
  () => import('getsentry/components/features/performanceNewProjectPrompt')
);
const ProjectPerformanceScoreCardLazy = lazy(
  () => import('getsentry/components/features/projectPerformanceScoreCard')
);
const GSBillingNavigationConfigLazy = lazy(
  () => import('getsentry/components/gsBillingNavigationConfig')
);
const HelpSearchFooterLazy = lazy(() => import('getsentry/components/helpSearchFooter'));
const InviteMembersButtonCustomizationLazy = lazy(
  () => import('getsentry/components/inviteMembersButtonCustomization')
);
const LabelWithPowerIconLazy = lazy(
  () => import('getsentry/components/labelWithPowerIcon')
);
const MemberInviteModalCustomizationLazy = lazy(
  () => import('getsentry/components/memberInviteModalCustomization')
);
const OrganizationHeaderLazy = lazy(() =>
  import('getsentry/components/organizationHeader').then(m => ({
    default: m.OrganizationHeader,
  }))
);
const PowerFeatureHovercardLazy = lazy(
  () => import('getsentry/components/powerFeatureHovercard')
);
const ProductSelectionAvailabilityLazy = lazy(() =>
  import('getsentry/components/productSelectionAvailability').then(m => ({
    default: m.ProductSelectionAvailability,
  }))
);
const ProductUnavailableCTALazy = lazy(() =>
  import('getsentry/components/productUnavailableCTA').then(m => ({
    default: m.ProductUnavailableCTA,
  }))
);
const ReplayOnboardingCTALazy = lazy(
  () => import('getsentry/components/replayOnboardingCTA')
);
const ReplayZendeskFeedbackLazy = lazy(
  () => import('getsentry/components/replayZendeskFeedback')
);
const SidebarNavigationItemLazy = lazy(
  () => import('getsentry/components/sidebarNavigationItem')
);
const SuperuserWarningLazy = lazy(
  () => import('getsentry/components/superuser/superuserWarning')
);
const TryBusinessSidebarItemLazy = lazy(
  () => import('getsentry/components/tryBusinessSidebarItem')
);
const DashboardsLimitProviderLazy = lazy(() =>
  import('getsentry/hooks/dashboardsLimit').then(m => ({
    default: m.DashboardsLimitProvider,
  }))
);
const DisabledCustomSymbolSourcesLazy = lazy(
  () => import('getsentry/hooks/disabledCustomSymbolSources')
);
const DisabledMemberTooltipLazy = lazy(
  () => import('getsentry/hooks/disabledMemberTooltip')
);
const FirstPartyIntegrationAdditionalCTALazy = lazy(
  () => import('getsentry/hooks/firstPartyIntegrationAdditionalCTA')
);
const FirstPartyIntegrationAlertHookLazy = lazy(
  () => import('getsentry/hooks/firstPartyIntegrationAlertHook')
);
const GithubInstallationSelectInstallButtonLazy = lazy(
  () => import('getsentry/hooks/githubInstallationSelectInstall')
);
const MemberListHeaderLazy = lazy(() => import('getsentry/hooks/memberListHeader'));
const OrganizationMembershipSettingsFormLazy = lazy(
  () => import('getsentry/hooks/organizationMembershipSettingsForm')
);
const OrgStatsBannerLazy = lazy(() => import('getsentry/hooks/orgStatsBanner'));
const OrgStatsProfilingBannerLazy = lazy(
  () => import('getsentry/hooks/orgStatsProfilingBanner')
);
const EnhancedOrganizationStatsLazy = lazy(
  () => import('getsentry/hooks/spendVisibility/enhancedIndex')
);
const SpikeProtectionProjectSettingsLazy = lazy(
  () => import('getsentry/hooks/spendVisibility/spikeProtectionProjectSettings')
);
const SuperuserAccessCategoryLazy = lazy(
  () => import('getsentry/hooks/superuserAccessCategory')
);
const TargetedOnboardingHeaderLazy = lazy(
  () => import('getsentry/hooks/targetedOnboardingHeader')
);
const CodecovSettingsLinkLazy = lazy(() =>
  import('./components/codecovSettingsLink').then(m => ({
    default: m.CodecovSettingsLink,
  }))
);
const PrimaryNavigationQuotaExceededLazy = lazy(
  () => import('./components/navBillingStatus')
);
const OpenInDiscoverBtnLazy = lazy(() => import('./components/openInDiscoverBtn'));
const ContinuousProfilingBetaAlertBannerLazy = lazy(() =>
  import('./components/profiling/alerts').then(m => ({
    default: m.ContinuousProfilingBetaAlertBanner,
  }))
);
const ContinuousProfilingBetaSDKAlertBannerLazy = lazy(() =>
  import('./components/profiling/alerts').then(m => ({
    default: m.ContinuousProfilingBetaSDKAlertBanner,
  }))
);
const ProfilingBetaAlertBannerLazy = lazy(() =>
  import('./components/profiling/alerts').then(m => ({
    default: m.ProfilingBetaAlertBanner,
  }))
);
const ReplayOnboardingAlertLazy = lazy(
  () => import('./components/replayOnboardingAlert')
);
const ReplaySettingsAlertLazy = lazy(() => import('./components/replaySettingsAlert'));

const PartnershipAgreement = lazy(() => import('getsentry/views/partnershipAgreement'));
const DisabledDiscover2Page = lazy(
  () => import('./components/features/disabledDiscover2Page')
);

const DisabledPerformancePage = lazy(
  () => import('./components/features/disabledPerformancePage')
);

const DisabledAlertsPage = lazy(() => import('./components/features/disabledAlertsPage'));

const DisabledDashboardPage = lazy(
  () => import('./components/features/disabledDashboardPage')
);

const DisabledMemberViewLazy = lazy(() => import('getsentry/hooks/disabledMemberView'));

const GETSENTRY_HOOKS: Partial<Hooks> = {
  /**
   * Additional routes to be inserted into sentrys route tree
   */
  'routes:root': hookRootRoutes,
  'routes:settings': hookSettingsRoutes,
  'routes:legacy-organization-redirects': legacyOrganizationRedirectRoutes,

  /**
   * Analytics functionality
   */
  'analytics:raw-track-event': rawTrackAnalyticsEvent,
  'analytics:init-user': hookAnalyticsInitUser,
  'metrics:event': trackMetric,

  /**
   * Sidebar augmentation
   */
  'sidebar:organization-dropdown-menu': hookSidebarDropdownMenu,
  'sidebar:help-menu': hookSidebarHelpMenu,
  'sidebar:item-label': () => props => (
    <LazyLoad LazyComponent={LabelWithPowerIconLazy} {...props} />
  ),
  'sidebar:try-business': props => (
    <LazyLoad
      LazyComponent={TryBusinessSidebarItemLazy}
      key="try-business-sidebar-item"
      {...props}
    />
  ),
  'sidebar:billing-status': props => (
    <LazyLoad
      LazyComponent={PrimaryNavigationQuotaExceededLazy}
      key="quota-exceeded-sidebar-item"
      organization={props.organization}
    />
  ),

  /**
   * Augment the global help search modal with a contat support button
   */
  'help-modal:footer': props => (
    <LazyLoad LazyComponent={HelpSearchFooterLazy} key="help-search-footer" {...props} />
  ),

  /**
   * Settings navigation configuration component
   */
  'settings:organization-navigation': organization => (
    <LazyLoad LazyComponent={GSBillingNavigationConfigLazy} organization={organization} />
  ),

  /**
   * Augment the header with the getsentry banners. This includes banners
   * and modals for various overage warnings.
   */
  'component:organization-header': () => props => (
    <LazyLoad LazyComponent={OrganizationHeaderLazy} {...props} />
  ),

  /**
   * Ensure the Invite Members button is always enabled without regard for the
   * `feature:invite-members` flag.
   */
  'member-invite-button:customization': () => props => (
    <LazyLoad LazyComponent={InviteMembersButtonCustomizationLazy} {...props} />
  ),

  /**
   * Augment the invite members modal component to start a trial before
   * inviting members.
   */
  'member-invite-modal:customization': () => props => (
    <LazyLoad LazyComponent={MemberInviteModalCustomizationLazy} {...props} />
  ),

  /**
   * Wrap navigation items in the main sidebar with a possible upsell, if
   * that navigation item is not available on the current plan tier. The
   * upsell blocks the button, and shows the upsell popup on hover. Very
   * similar to `sidebar:item-label`, but wraps the entire link. Expects
   * a render prop.
   */
  'sidebar:navigation-item': () => props => (
    <LazyLoad LazyComponent={SidebarNavigationItemLazy} {...props} />
  ),

  /**
   * Augment the targeted onboarding page with a different header
   */
  'onboarding:targeted-onboarding-header': ({source}: {source: string}) => (
    <LazyLoad
      LazyComponent={TargetedOnboardingHeaderLazy}
      source={source}
      key="targeted-onboarding-header"
    />
  ),

  /**
   * Get list of organization roles
   */
  'member-invite-modal:organization-roles': getOrgRoles,

  /**
   * Ensure we enable/disable Pendo when guides change
   */
  'callback:on-guide-update': handleGuideUpdate,

  /**
   * Ensure we refresh subscription when monitors are created
   */
  'callback:on-monitor-created': handleMonitorCreated,

  /**
   * Hooks related to Spend Visibility (i.e. Per-Project Spike Protection + Spend Allocations)
   */
  'spend-visibility:spike-protection-project-settings': p => (
    <LazyLoad LazyComponent={SpikeProtectionProjectSettingsLazy} {...p} />
  ),

  /**
   *   Given a module name, if applicable, displays the appropriate upsell page
   */
  'component:insights-upsell-page': () => props => (
    <LazyLoad LazyComponent={InsightsUpsellPageLazy} {...props} />
  ),
  'component:insights-date-range-query-limit-footer': () => props => (
    <LazyLoad LazyComponent={InsightsDateRangeQueryLimitFooterLazy} {...props} />
  ),
  'component:ai-setup-data-consent': () => props => (
    <LazyLoad LazyComponent={AiSetupDataConsentLazy} {...props} />
  ),
  'component:codecov-integration-settings-link': () => props => (
    <LazyLoad LazyComponent={CodecovSettingsLinkLazy} {...props} />
  ),
  'component:continuous-profiling-beta-banner': () => props => (
    <LazyLoad LazyComponent={ContinuousProfilingBetaAlertBannerLazy} {...props} />
  ),
  'component:continuous-profiling-beta-sdk-banner': () => props => (
    <LazyLoad LazyComponent={ContinuousProfilingBetaSDKAlertBannerLazy} {...props} />
  ),
  'component:explore-date-range-query-limit-footer': () => props => (
    <LazyLoad LazyComponent={ExploreDateRangeQueryLimitFooterLazy} {...props} />
  ),
  /**
   * Augment the datetime picker based on plan retention days. Includes upsell interface
   */
  'component:header-date-range': () => props => (
    <LazyLoad LazyComponent={DisabledDateRangeLazy} {...props} />
  ),
  'component:header-selector-items': () => props => (
    <LazyLoad LazyComponent={DisabledSelectorItemsLazy} {...props} />
  ),
  'component:member-list-header': () => props => (
    <LazyLoad LazyComponent={MemberListHeaderLazy} {...props} />
  ),
  'component:disabled-member': () => props => (
    <LazyLoad LazyComponent={DisabledMemberViewLazy} {...props} />
  ),
  'component:disabled-member-tooltip': () => props => (
    <LazyLoad LazyComponent={DisabledMemberTooltipLazy} {...props} />
  ),
  'component:disabled-custom-symbol-sources': () => props => (
    <LazyLoad LazyComponent={DisabledCustomSymbolSourcesLazy} {...props} />
  ),
  'component:dashboards-header': () => props => (
    <LazyLoad LazyComponent={DashboardBannerLazy} {...props} />
  ),
  'component:org-stats-banner': () => props => (
    <LazyLoad LazyComponent={OrgStatsBannerLazy} {...props} />
  ),
  'component:org-stats-profiling-banner': () => props => (
    <LazyLoad LazyComponent={OrgStatsProfilingBannerLazy} {...props} />
  ),
  'component:enhanced-org-stats': () => props => (
    <LazyLoad LazyComponent={EnhancedOrganizationStatsLazy} {...props} />
  ),
  'component:first-party-integration-alert': () => props => (
    <LazyLoad LazyComponent={FirstPartyIntegrationAlertHookLazy} {...props} />
  ),
  'component:first-party-integration-additional-cta': () => props => (
    <LazyLoad LazyComponent={FirstPartyIntegrationAdditionalCTALazy} {...props} />
  ),
  'component:replay-feedback-button': () => props => (
    <LazyLoad LazyComponent={ReplayZendeskFeedbackLazy} {...props} />
  ),
  'component:replay-onboarding-alert': () => props => (
    <LazyLoad LazyComponent={ReplayOnboardingAlertLazy} {...props} />
  ),
  'component:replay-onboarding-cta': () => props => (
    <LazyLoad LazyComponent={ReplayOnboardingCTALazy} {...props} />
  ),
  'component:replay-settings-alert': () => props => (
    <LazyLoad LazyComponent={ReplaySettingsAlertLazy} {...props} />
  ),
  'component:product-unavailable-cta': () => props => (
    <LazyLoad LazyComponent={ProductUnavailableCTALazy} {...props} />
  ),
  'component:profiling-billing-banner': () => props => (
    <LazyLoad LazyComponent={ProfilingBetaAlertBannerLazy} {...props} />
  ),
  'component:product-selection-availability': () => props => (
    <LazyLoad LazyComponent={ProductSelectionAvailabilityLazy} {...props} />
  ),
  'component:superuser-access-category': props => (
    <LazyLoad LazyComponent={SuperuserAccessCategoryLazy} {...props} />
  ),
  'component:superuser-warning': p => (
    <LazyLoad LazyComponent={SuperuserWarningLazy} {...p} />
  ),
  'component:superuser-warning-excluded': shouldExcludeOrg,
  'component:crons-list-page-header': () => props => (
    <LazyLoad LazyComponent={CronsBillingBannerLazy} {...props} />
  ),
  'react-hook:route-activated': useRouteActivatedHook,
  'react-hook:use-button-tracking': useButtonTracking,
  'react-hook:use-get-max-retention-days': useGetMaxRetentionDays,
  'component:partnership-agreement': p => (
    <LazyLoad LazyComponent={PartnershipAgreement} {...p} />
  ),
  'component:dashboards-limit-provider': () => props => (
    <LazyLoad LazyComponent={DashboardsLimitProviderLazy} {...props} />
  ),
  'component:data-consent-banner': () => props => (
    <LazyLoad LazyComponent={DataConsentBannerLazy} {...props} />
  ),
  'component:data-consent-priority-learn-more': () => props => (
    <LazyLoad LazyComponent={DataConsentPriorityLearnMoreLazy} {...props} />
  ),
  'component:data-consent-org-creation-checkbox': () => props => (
    <LazyLoad LazyComponent={DataConsentOrgCreationCheckboxLazy} {...props} />
  ),
  'component:organization-membership-settings': () => props => (
    <LazyLoad LazyComponent={OrganizationMembershipSettingsFormLazy} {...props} />
  ),
  'component:scm-multi-org-install-button': () => props => (
    <LazyLoad LazyComponent={GithubInstallationSelectInstallButtonLazy} {...props} />
  ),

  /**
   * Augment disable feature hooks for augmenting with upsell interfaces
   */

  'feature-disabled:discard-groups': p => (
    <LazyLoad LazyComponent={DisabledDiscardGroupLazy} {...p} />
  ),
  'feature-disabled:data-forwarding': p => (
    <LazyLoad LazyComponent={DisabledDataForwardingLazy} {...p} />
  ),
  'feature-disabled:relay': p => <LazyLoad LazyComponent={DisabledRelayLazy} {...p} />,
  'feature-disabled:rate-limits': p => (
    <LazyLoad LazyComponent={DisabledRateLimitsLazy} {...p} />
  ),
  'feature-disabled:sso-basic': p => (
    <LazyLoad LazyComponent={DisabledAuthProviderLazy} {...p} />
  ),
  'feature-disabled:sso-saml2': p => (
    <LazyLoad LazyComponent={DisabledAuthProviderLazy} {...p} />
  ),
  'feature-disabled:custom-inbound-filters': p => (
    <LazyLoad LazyComponent={DisabledCustomInboundFiltersLazy} {...p} />
  ),
  'feature-disabled:discover2-sidebar-item': p =>
    typeof p.children === 'function' ? p.children(p) : p.children,
  'feature-disabled:performance-new-project': p => (
    <LazyLoad LazyComponent={PerformanceNewProjectPromptLazy} {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </LazyLoad>
  ),
  'feature-disabled:discover2-page': p => (
    <LazyLoad LazyComponent={DisabledDiscover2Page} {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </LazyLoad>
  ),
  'feature-disabled:performance-page': p => (
    <LazyLoad LazyComponent={DisabledPerformancePage} {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </LazyLoad>
  ),
  'feature-disabled:performance-quick-trace': p => (
    <LazyLoad LazyComponent={DisabledQuickTraceLazy} {...p} />
  ),
  'feature-disabled:alerts-page': p => (
    <LazyLoad
      LazyComponent={DisabledAlertsPage}
      organization={p.organization}
      features={p.features}
    />
  ),
  'feature-disabled:dashboards-sidebar-item': p =>
    typeof p.children === 'function' ? p.children(p) : p.children,
  'feature-disabled:dashboards-page': p => (
    <LazyLoad LazyComponent={DisabledDashboardPage} {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </LazyLoad>
  ),
  'feature-disabled:alert-wizard-performance': p => (
    <LazyLoad LazyComponent={DisabledAlertWizardLazy} {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </LazyLoad>
  ),
  'feature-disabled:codecov-integration-setting': () => (
    <LazyLoad
      LazyComponent={PowerFeatureHovercardLazy}
      features={['organizations:codecov-integration']}
      id="codecov-integration"
    >
      <IconBusiness size="sm" data-test-id="power-icon" />
    </LazyLoad>
  ),
  'feature-disabled:project-performance-score-card': p => (
    <LazyLoad LazyComponent={ProjectPerformanceScoreCardLazy} {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </LazyLoad>
  ),
  'feature-disabled:project-selector-checkbox': p => (
    <LazyLoad
      LazyComponent={PowerFeatureHovercardLazy}
      features={['organizations:global-views']}
      id="global-views"
    >
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </LazyLoad>
  ),
  'feature-disabled:project-selector-all-projects': p => (
    <LazyLoad LazyComponent={DisabledAllProjectsSelectLazy} {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </LazyLoad>
  ),
  'feature-disabled:open-discover': p => (
    <LazyLoad
      LazyComponent={PowerFeatureHovercardLazy}
      features={['organizations:discover-basic']}
      id="open-discover"
    >
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </LazyLoad>
  ),
  'feature-disabled:dashboards-edit': p => (
    <LazyLoad
      LazyComponent={PowerFeatureHovercardLazy}
      features={['organizations:dashboards-edit']}
      id="dashboards-edit"
    >
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </LazyLoad>
  ),
  'feature-disabled:grid-editable-actions': p => (
    <LazyLoad
      LazyComponent={PowerFeatureHovercardLazy}
      features={['organizations:discover-query']}
      id="discover-query"
    >
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </LazyLoad>
  ),
  'feature-disabled:discover-saved-query-create': p => (
    <LazyLoad
      LazyComponent={PowerFeatureHovercardLazy}
      features={['organizations:discover-query']}
      id="discover-saved-query"
    >
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </LazyLoad>
  ),
  'feature-disabled:open-in-discover': p => (
    <LazyLoad LazyComponent={OpenInDiscoverBtnLazy} {...p} />
  ),
  'feature-disabled:issue-views': p => (
    <LazyLoad
      LazyComponent={PowerFeatureHovercardLazy}
      features={['organizations:issue-views']}
      id="issue-views"
      useLearnMoreLink
    >
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </LazyLoad>
  ),

  /**
   * Augment integration installation modals with feature grouping based on
   * plan availability
   */
  'integrations:feature-gates': hookIntegrationFeatures,
};

// NOTE(ts): We modify the signature of Object.entries here so that we can
// obtain the proper type tuples while iterating our hooks list.
const entries = Object.entries as <T>(
  o: T
) => Array<[Extract<keyof T, string>, T[keyof T]]>;

const registerHooks = () =>
  entries(GETSENTRY_HOOKS).forEach(entry => HookStore.add(...entry));

export default registerHooks;
