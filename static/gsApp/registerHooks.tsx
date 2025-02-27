import {lazy} from 'react';

import LazyLoad from 'sentry/components/lazyLoad';
import {IconBusiness} from 'sentry/icons';
import HookStore from 'sentry/stores/hookStore';
import type {Hooks} from 'sentry/types/hooks';

import AiSetupDataConsent from 'getsentry/components/ai/AiSetupDataConsent';
import CronsBillingBanner from 'getsentry/components/crons/cronsBillingBanner';
import DashboardBanner from 'getsentry/components/dashboardBanner';
import DataConsentBanner from 'getsentry/components/dataConsentBanner';
import DataConsentOrgCreationCheckbox from 'getsentry/components/dataConsentCheckbox';
import DataConsentPriorityLearnMore from 'getsentry/components/dataConsentPriorityLearnMore';
import DisabledAlertWizard from 'getsentry/components/features/disabledAlertWizard';
import DisabledAllProjectsSelect from 'getsentry/components/features/disabledAllProjectsSelect';
import DisabledAuthProvider from 'getsentry/components/features/disabledAuthProvider';
import DisabledCustomInboundFilters from 'getsentry/components/features/disabledCustomInboundFilters';
import DisabledDataForwarding from 'getsentry/components/features/disabledDataForwarding';
import DisabledDateRange from 'getsentry/components/features/disabledDateRange';
import DisabledDiscardGroup from 'getsentry/components/features/disabledDiscardGroup';
import DisabledMetricsAlertTooltip from 'getsentry/components/features/disabledMetricsAlertTooltip';
import DisabledQuickTrace from 'getsentry/components/features/disabledQuickTrace';
import DisabledRateLimits from 'getsentry/components/features/disabledRateLimits';
import DisabledRelay from 'getsentry/components/features/disabledRelay';
import DisabledSelectorItems from 'getsentry/components/features/disabledSelectorItems';
import InsightsDateRangeQueryLimitFooter from 'getsentry/components/features/insightsDateRangeQueryLimitFooter';
import InsightsUpsellPage from 'getsentry/components/features/insightsUpsellPage';
import PerformanceNewProjectPrompt from 'getsentry/components/features/performanceNewProjectPrompt';
import ProjectPerformanceScoreCard from 'getsentry/components/features/projectPerformanceScoreCard';
import GSBillingNavigationConfig from 'getsentry/components/gsBillingNavigationConfig';
import HelpSearchFooter from 'getsentry/components/helpSearchFooter';
import InviteMembersButtonCustomization from 'getsentry/components/inviteMembersButtonCustomization';
import LabelWithPowerIcon from 'getsentry/components/labelWithPowerIcon';
import MemberInviteModalCustomization from 'getsentry/components/memberInviteModalCustomization';
import OnboardingWizardHelp from 'getsentry/components/onboardingWizardHelp';
import {OrganizationHeader} from 'getsentry/components/organizationHeader';
import QuotaExceededAlert from 'getsentry/components/performance/quotaExceededAlert';
import PowerFeatureHovercard from 'getsentry/components/powerFeatureHovercard';
import {ProductSelectionAvailability} from 'getsentry/components/productSelectionAvailability';
import {ProductUnavailableCTA} from 'getsentry/components/productUnavailableCTA';
import ReplayOnboardingCTA from 'getsentry/components/replayOnboardingCTA';
import ReplayZendeskFeedback from 'getsentry/components/replayZendeskFeedback';
import SidebarNavigationItem from 'getsentry/components/sidebarNavigationItem';
import SuperuserWarning, {
  shouldExcludeOrg,
} from 'getsentry/components/superuser/superuserWarning';
import TryBusinessSidebarItem from 'getsentry/components/tryBusinessSidebarItem';
import hookAnalyticsInitUser from 'getsentry/hooks/analyticsInitUser';
import DisabledCustomSymbolSources from 'getsentry/hooks/disabledCustomSymbolSources';
import DisabledMemberTooltip from 'getsentry/hooks/disabledMemberTooltip';
import DisabledMemberView from 'getsentry/hooks/disabledMemberView';
import FirstPartyIntegrationAdditionalCTA from 'getsentry/hooks/firstPartyIntegrationAdditionalCTA';
import FirstPartyIntegrationAlertHook from 'getsentry/hooks/firstPartyIntegrationAlertHook';
import handleGuideUpdate from 'getsentry/hooks/handleGuideUpdate';
import {handleMonitorCreated} from 'getsentry/hooks/handleMonitorCreated';
import hookIntegrationFeatures from 'getsentry/hooks/integrationFeatures';
import legacyOrganizationRedirectRoutes from 'getsentry/hooks/legacyOrganizationRedirectRoutes';
import MemberListHeader from 'getsentry/hooks/memberListHeader';
import OrganizationMembershipSettingsForm from 'getsentry/hooks/organizationMembershipSettingsForm';
import OrgStatsBanner from 'getsentry/hooks/orgStatsBanner';
import hookRootRoutes from 'getsentry/hooks/rootRoutes';
import hookSettingsRoutes from 'getsentry/hooks/settingsRoutes';
import hookSidebarDropdownMenu from 'getsentry/hooks/sidebarDropdownMenu';
import hookSidebarHelpMenu from 'getsentry/hooks/sidebarHelpMenu';
import EnhancedOrganizationStats from 'getsentry/hooks/spendVisibility/enhancedIndex';
import SpikeProtectionProjectSettings from 'getsentry/hooks/spendVisibility/spikeProtectionProjectSettings';
import SuperuserAccessCategory from 'getsentry/hooks/superuserAccessCategory';
import TargetedOnboardingHeader from 'getsentry/hooks/targetedOnboardingHeader';
import {useExperiment} from 'getsentry/hooks/useExperiment';
import logExperiment from 'getsentry/utils/logExperiment';
import rawTrackAnalyticsEvent from 'getsentry/utils/rawTrackAnalyticsEvent';
import trackMetric from 'getsentry/utils/trackMetric';

import {CodecovSettingsLink} from './components/codecovSettingsLink';
import OpenInDiscoverBtn from './components/openInDiscoverBtn';
import {
  ProfilingAM1OrMMXUpgrade,
  ProfilingBetaAlertBanner,
  ProfilingUpgradePlanButton,
} from './components/profiling/alerts';
import ReplayOnboardingAlert from './components/replayOnboardingAlert';
import ReplaySettingsAlert from './components/replaySettingsAlert';
import useButtonTracking from './hooks/useButtonTracking';
import useGetMaxRetentionDays from './hooks/useGetMaxRetentionDays';
import useRouteActivatedHook from './hooks/useRouteActivatedHook';

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
  'analytics:log-experiment': logExperiment,
  'metrics:event': trackMetric,

  /**
   * Sidebar augmentation
   */
  'sidebar:organization-dropdown-menu': hookSidebarDropdownMenu,
  'sidebar:help-menu': hookSidebarHelpMenu,
  'sidebar:item-label': () => LabelWithPowerIcon,
  'sidebar:bottom-items': props => <TryBusinessSidebarItem {...props} />,

  /**
   * Augment the global help search modal with a contat support button
   */
  'help-modal:footer': props => <HelpSearchFooter key="help-search-footer" {...props} />,

  /**
   * Settings navigation configuration component
   */
  'settings:organization-navigation': organization => (
    <GSBillingNavigationConfig organization={organization} />
  ),

  /**
   * Augment the header with the getsentry banners. This includes banners
   * and modals for various overage warnings.
   */
  'component:organization-header': () => OrganizationHeader,

  /**
   * Ensure the Invite Members button is always enabled without regard for the
   * `feature:invite-members` flag.
   */
  'member-invite-button:customization': () => InviteMembersButtonCustomization,

  /**
   * Augment the invite members modal component to start a trial before
   * inviting members.
   */
  'member-invite-modal:customization': () => MemberInviteModalCustomization,

  /**
   * Wrap navigation items in the main sidebar with a possible upsell, if
   * that navigation item is not available on the current plan tier. The
   * upsell blocks the button, and shows the upsell popup on hover. Very
   * similar to `sidebar:item-label`, but wraps the entire link. Expects
   * a render prop.
   */
  'sidebar:navigation-item': () => SidebarNavigationItem,

  /**
   * Augment the targeted onboarding page with a different header
   */
  'onboarding:targeted-onboarding-header': ({source}: {source: string}) => (
    <TargetedOnboardingHeader source={source} key="targeted-onboarding-header" />
  ),

  /**
   * Augment the onboarding wizard skip confirm help button
   */
  'onboarding-wizard:skip-help': () => OnboardingWizardHelp,

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
    <SpikeProtectionProjectSettings {...p} />
  ),
  /**
   *   Tracing units exceeded alerts
   */
  'component:performance-quota-exceeded-alert': () => QuotaExceededAlert,
  /**
   *   Given a module name, if applicable, displays the appropriate upsell page
   */
  'component:insights-upsell-page': () => InsightsUpsellPage,
  'component:insights-date-range-query-limit-footer': () =>
    InsightsDateRangeQueryLimitFooter,
  'component:ai-setup-data-consent': () => AiSetupDataConsent,
  'component:codecov-integration-settings-link': () => CodecovSettingsLink,
  /**
   * Augment the datetime picker based on plan retention days. Includes upsell interface
   */
  'component:header-date-range': () => DisabledDateRange,
  'component:header-selector-items': () => DisabledSelectorItems,
  'component:member-list-header': () => MemberListHeader,
  'component:disabled-member': () => DisabledMemberView,
  'component:disabled-member-tooltip': () => DisabledMemberTooltip,
  'component:disabled-custom-symbol-sources': () => DisabledCustomSymbolSources,
  'component:dashboards-header': () => DashboardBanner,
  'component:org-stats-banner': () => OrgStatsBanner,
  'component:enhanced-org-stats': () => EnhancedOrganizationStats,
  'component:first-party-integration-alert': () => FirstPartyIntegrationAlertHook,
  'component:first-party-integration-additional-cta': () =>
    FirstPartyIntegrationAdditionalCTA,
  'component:replay-feedback-button': () => ReplayZendeskFeedback,
  'component:replay-onboarding-alert': () => ReplayOnboardingAlert,
  'component:replay-onboarding-cta': () => ReplayOnboardingCTA,
  'component:replay-settings-alert': () => ReplaySettingsAlert,
  'component:product-unavailable-cta': () => ProductUnavailableCTA,
  'component:profiling-billing-banner': () => ProfilingBetaAlertBanner,
  'component:profiling-upgrade-plan-button': () => ProfilingUpgradePlanButton,
  'component:profiling-am1-or-mmx-upgrade': () => ProfilingAM1OrMMXUpgrade,
  'component:product-selection-availability': () => ProductSelectionAvailability,
  'component:superuser-access-category': SuperuserAccessCategory,
  'component:superuser-warning': p => <SuperuserWarning {...p} />,
  'component:superuser-warning-excluded': shouldExcludeOrg,
  'component:crons-list-page-header': () => CronsBillingBanner,
  'react-hook:route-activated': useRouteActivatedHook,
  'react-hook:use-button-tracking': useButtonTracking,
  'react-hook:use-experiment': useExperiment,
  'react-hook:use-get-max-retention-days': useGetMaxRetentionDays,
  'component:partnership-agreement': p => (
    <LazyLoad LazyComponent={PartnershipAgreement} {...p} />
  ),
  'component:data-consent-banner': () => DataConsentBanner,
  'component:data-consent-priority-learn-more': () => DataConsentPriorityLearnMore,
  'component:data-consent-org-creation-checkbox': () => DataConsentOrgCreationCheckbox,
  'component:organization-membership-settings': () => OrganizationMembershipSettingsForm,

  /**
   * Augment disable feature hooks for augmenting with upsell interfaces
   */

  'feature-disabled:discard-groups': p => <DisabledDiscardGroup {...p} />,
  'feature-disabled:data-forwarding': p => <DisabledDataForwarding {...p} />,
  'feature-disabled:relay': p => <DisabledRelay {...p} />,
  'feature-disabled:rate-limits': p => <DisabledRateLimits {...p} />,
  'feature-disabled:sso-basic': p => <DisabledAuthProvider {...p} />,
  'feature-disabled:sso-saml2': p => <DisabledAuthProvider {...p} />,
  'feature-disabled:custom-inbound-filters': p => <DisabledCustomInboundFilters {...p} />,
  'feature-disabled:discover2-sidebar-item': p =>
    typeof p.children === 'function' ? p.children(p) : p.children,
  'feature-disabled:incidents-sidebar-item': p =>
    typeof p.children === 'function' ? p.children(p) : p.children,
  'feature-disabled:performance-new-project': p => (
    <PerformanceNewProjectPrompt {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </PerformanceNewProjectPrompt>
  ),
  'feature-disabled:performance-sidebar-item': p =>
    typeof p.children === 'function' ? p.children(p) : p.children,
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
  'feature-disabled:performance-quick-trace': p => <DisabledQuickTrace {...p} />,
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
    <DisabledAlertWizard {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </DisabledAlertWizard>
  ),
  'feature-disabled:create-metrics-alert-tooltip': p => (
    <DisabledMetricsAlertTooltip {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </DisabledMetricsAlertTooltip>
  ),
  'feature-disabled:codecov-integration-setting': () => (
    <PowerFeatureHovercard
      features={['organizations:codecov-integration']}
      id="codecov-integration"
    >
      <IconBusiness size="sm" data-test-id="power-icon" />
    </PowerFeatureHovercard>
  ),
  'feature-disabled:project-performance-score-card': p => (
    <ProjectPerformanceScoreCard {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </ProjectPerformanceScoreCard>
  ),
  'feature-disabled:project-selector-checkbox': p => (
    <PowerFeatureHovercard features={['organizations:global-views']} id="global-views">
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </PowerFeatureHovercard>
  ),
  'feature-disabled:project-selector-all-projects': p => (
    <DisabledAllProjectsSelect {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </DisabledAllProjectsSelect>
  ),
  'feature-disabled:open-discover': p => (
    <PowerFeatureHovercard features={['organizations:discover-basic']} id="open-discover">
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </PowerFeatureHovercard>
  ),
  'feature-disabled:dashboards-edit': p => (
    <PowerFeatureHovercard
      features={['organizations:dashboards-edit']}
      id="dashboards-edit"
      upsellDefaultSelection="custom-dashboards"
    >
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </PowerFeatureHovercard>
  ),
  'feature-disabled:grid-editable-actions': p => (
    <PowerFeatureHovercard
      features={['organizations:discover-query']}
      id="discover-query"
    >
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </PowerFeatureHovercard>
  ),
  'feature-disabled:discover-saved-query-create': p => (
    <PowerFeatureHovercard
      features={['organizations:discover-query']}
      id="discover-saved-query"
    >
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </PowerFeatureHovercard>
  ),
  'feature-disabled:open-in-discover': p => <OpenInDiscoverBtn {...p} />,
  'feature-disabled:trace-view-link': p => (
    <PowerFeatureHovercard
      // TODO(wmak): Flip back to trace-view-summary when we add it to plans
      features={['organizations:discover-query']}
      id="trace-view-link"
    >
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </PowerFeatureHovercard>
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
