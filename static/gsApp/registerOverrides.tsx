import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {registerOverride} from 'sentry/overrideRegistry';
import type {Overrides} from 'sentry/types/overrides';
import type {OrganizationStatsProps} from 'sentry/views/organizationStats';

import {AiConfigureSeerQuotaSidebar} from 'getsentry/components/ai/aiConfigureSeerQuotaSidebar';
import {AiSetupDataConsent} from 'getsentry/components/ai/AiSetupDataConsent';
import CronsBillingBanner from 'getsentry/components/crons/cronsBillingBanner';
import {DashboardBanner} from 'getsentry/components/dashboardBanner';
import DataConsentBanner from 'getsentry/components/dataConsentBanner';
import {DataConsentOrgCreationCheckbox} from 'getsentry/components/dataConsentCheckbox';
import DataConsentPriorityLearnMore from 'getsentry/components/dataConsentPriorityLearnMore';
import DateRangeQueryLimitFooter from 'getsentry/components/features/dateRangeQueryLimitFooter';
import {DisabledAlertWizard} from 'getsentry/components/features/disabledAlertWizard';
import {DisabledAuthProvider} from 'getsentry/components/features/disabledAuthProvider';
import {DisabledCustomInboundFilters} from 'getsentry/components/features/disabledCustomInboundFilters';
import {DisabledDataForwarding} from 'getsentry/components/features/disabledDataForwarding';
import DisabledDateRange from 'getsentry/components/features/disabledDateRange';
import {DisabledDiscardGroup} from 'getsentry/components/features/disabledDiscardGroup';
import {DisabledRateLimits} from 'getsentry/components/features/disabledRateLimits';
import DisabledSelectorItems from 'getsentry/components/features/disabledSelectorItems';
import InsightsDateRangeQueryLimitFooter from 'getsentry/components/features/insightsDateRangeQueryLimitFooter';
import {PerformanceNewProjectPrompt} from 'getsentry/components/features/performanceNewProjectPrompt';
import {ProjectPerformanceScoreCard} from 'getsentry/components/features/projectPerformanceScoreCard';
import {HelpSearchFooter} from 'getsentry/components/helpSearchFooter';
import {InviteMembersButtonCustomization} from 'getsentry/components/inviteMembersButtonCustomization';
import LabelWithPowerIcon from 'getsentry/components/labelWithPowerIcon';
import MemberInviteModalCustomization from 'getsentry/components/memberInviteModalCustomization';
import {
  MetricAlertQuotaIcon,
  MetricAlertQuotaMessage,
} from 'getsentry/components/metricAlertQuotaMessage';
import {OrganizationHeader} from 'getsentry/components/organizationHeader';
import PowerFeatureHovercard from 'getsentry/components/powerFeatureHovercard';
import {PrimaryNavSeerConfigReminder} from 'getsentry/components/primaryNavSeerConfigReminder';
import {ProductSelectionAvailability} from 'getsentry/components/productSelectionAvailability';
import {ProductUnavailableCTA} from 'getsentry/components/productUnavailableCTA';
import {ReplayInit} from 'getsentry/components/replayInit';
import ReplayOnboardingCTA from 'getsentry/components/replayOnboardingCTA';
import {
  shouldExcludeOrg,
  SuperuserWarning,
} from 'getsentry/components/superuser/superuserWarning';
import TryBusinessSidebarItem from 'getsentry/components/tryBusinessSidebarItem';
import {analyticsInitUser} from 'getsentry/overrides/analyticsInitUser';
import {DashboardsLimitProvider} from 'getsentry/overrides/dashboardsLimit';
import {DisabledCustomSymbolSources} from 'getsentry/overrides/disabledCustomSymbolSources';
import DisabledMemberTooltip from 'getsentry/overrides/disabledMemberTooltip';
import DisabledMemberView from 'getsentry/overrides/disabledMemberView';
import {FirstPartyIntegrationAdditionalCTA} from 'getsentry/overrides/firstPartyIntegrationAdditionalCTA';
import {FirstPartyIntegrationAlertHook} from 'getsentry/overrides/firstPartyIntegrationAlertHook';
import {handleGuideUpdate} from 'getsentry/overrides/handleGuideUpdate';
import {handleMonitorCreated} from 'getsentry/overrides/handleMonitorCreated';
import {hookIntegrationFeatures} from 'getsentry/overrides/integrationFeatures';
import {legacyOrganizationRedirectRoutes} from 'getsentry/overrides/legacyOrganizationRedirectRoutes';
import MemberListHeader from 'getsentry/overrides/memberListHeader';
import {OrganizationMembershipSettingsForm} from 'getsentry/overrides/organizationMembershipSettingsForm';
import {getOrgRoles} from 'getsentry/overrides/organizationRoles';
import OrgStatsBanner from 'getsentry/overrides/orgStatsBanner';
import {OrgStatsProfilingBanner} from 'getsentry/overrides/orgStatsProfilingBanner';
import {rootRoutes} from 'getsentry/overrides/rootRoutes';
import {ScmGithubMultiOrgInstall} from 'getsentry/overrides/scmGithubMultiOrgInstall';
import {seerSettingsRoutes} from 'getsentry/overrides/seerSettingsRoutes';
import {SpikeProtectionProjectSettings} from 'getsentry/overrides/spendVisibility/spikeProtectionProjectSettings';
import {subscriptionSettingsRoutes} from 'getsentry/overrides/subscriptionSettingsRoutes';
import {SuperuserAccessCategory} from 'getsentry/overrides/superuserAccessCategory';
import TargetedOnboardingHeader from 'getsentry/overrides/targetedOnboardingHeader';
import {useBillingNavigationConfig} from 'getsentry/overrides/useBillingNavigationConfig';
import {useDashboardDatasetRetentionLimit} from 'getsentry/overrides/useDashboardDatasetRetentionLimit';
import {useExperiment} from 'getsentry/overrides/useExperiment';
import {useMetricDetectorLimit} from 'getsentry/overrides/useMetricDetectorLimit';
import {useProductBillingAccess} from 'getsentry/overrides/useProductBillingAccess';
import {useReplayForCriticalFlow} from 'getsentry/overrides/useReplayForCriticalFlow';
import {useScmFeatureMeta} from 'getsentry/overrides/useScmFeatureMeta';
import {rawTrackAnalyticsEvent} from 'getsentry/utils/rawTrackAnalyticsEvent';
import {trackMetric} from 'getsentry/utils/trackMetric';

import {GsBillingCommandPaletteActions} from './components/gsBillingCommandPaletteActions';
import {PrimaryNavigationQuotaExceeded} from './components/navBillingStatus';
import {OpenInDiscoverBtn} from './components/openInDiscoverBtn';
import {
  ContinuousProfilingBillingRequirementBanner,
  ProfilingBetaAlertBanner,
} from './components/profiling/alerts';
import ReplayOnboardingAlert from './components/replayOnboardingAlert';
import {ReplaySettingsAlert} from './components/replaySettingsAlert';
import {useButtonTracking} from './overrides/useButtonTracking';
import {useGetMaxRetentionDays} from './overrides/useGetMaxRetentionDays';
import {
  useDefaultMaxPickableDays,
  useMaxPickableDays,
} from './overrides/useMaxPickableDays';
import {useRouteActivatedHook} from './overrides/useRouteActivatedHook';

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

const EnhancedOrganizationStats = lazy(() =>
  import('getsentry/overrides/spendVisibility/enhancedIndex').then(module => ({
    default: module.EnhancedOrganizationStats,
  }))
);

function LazyEnhancedOrganizationStats(props: OrganizationStatsProps) {
  return <LazyLoad LazyComponent={EnhancedOrganizationStats} {...props} />;
}

const GETSENTRY_OVERRIDES: Partial<Overrides> = {
  /**
   * Additional routes to be inserted into sentrys route tree
   */
  'routes:root': rootRoutes,
  'routes:org-settings': seerSettingsRoutes,
  'routes:legacy-organization-redirects': legacyOrganizationRedirectRoutes,

  /**
   * This has more than just subscriptions...
   * and it uses it's own layout which makes it different from the other settings routes.
   */
  'routes:subscription-settings': subscriptionSettingsRoutes,

  /**
   * Analytics functionality
   */
  'analytics:raw-track-event': rawTrackAnalyticsEvent,
  'analytics:init-user': analyticsInitUser,
  'metrics:event': trackMetric,

  /**
   * Sidebar augmentation
   */
  'sidebar:item-label': () => LabelWithPowerIcon,
  'sidebar:seer-config-reminder': props => (
    <PrimaryNavSeerConfigReminder key="seer-config-reminder" {...props} />
  ),
  'sidebar:try-business': props => (
    <TryBusinessSidebarItem key="try-business-sidebar-item" {...props} />
  ),
  'sidebar:billing-status': props => (
    <PrimaryNavigationQuotaExceeded
      key="quota-exceeded-sidebar-item"
      organization={props.organization}
    />
  ),

  /**
   * Augment the global help search modal with a contact support button
   */
  'help-modal:footer': ({closeModal}) => (
    <HelpSearchFooter key="help-search-footer" closeModal={closeModal} />
  ),

  /**
   * Registers usage & billing org settings as globally-available CMDK actions.
   */
  'cmdk:global-settings-actions': () => <GsBillingCommandPaletteActions />,

  /**
   * Provides billing-related items for the org settings navigation.
   */
  'react-hook:use-billing-navigation-config': useBillingNavigationConfig,

  /**
   * Drives Sentry Replay registration at the App root, so non-org routes
   * like `/onboarding/*` are covered too.
   */
  'component:replay-init': ReplayInit,

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
   * Augment the targeted onboarding page with a different header
   */
  'onboarding:targeted-onboarding-header': ({source}: {source: string}) => (
    <TargetedOnboardingHeader source={source} key="targeted-onboarding-header" />
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
    <SpikeProtectionProjectSettings {...p} />
  ),

  /**
   *   Given a module name, if applicable, displays the appropriate upsell page
   */
  'component:insights-date-range-query-limit-footer': () =>
    InsightsDateRangeQueryLimitFooter,
  'component:ai-configure-seer-quota-sidebar': () => AiConfigureSeerQuotaSidebar,
  'component:ai-setup-data-consent': () => AiSetupDataConsent,
  'component:continuous-profiling-billing-requirement-banner': () =>
    ContinuousProfilingBillingRequirementBanner,
  'component:header-date-page-filter-upsell-footer': () => DateRangeQueryLimitFooter,
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
  'component:org-stats-profiling-banner': () => OrgStatsProfilingBanner,
  'component:enhanced-org-stats': () => LazyEnhancedOrganizationStats,
  'component:first-party-integration-alert': () => FirstPartyIntegrationAlertHook,
  'component:first-party-integration-additional-cta': () =>
    FirstPartyIntegrationAdditionalCTA,
  'component:scm-github-multi-org-install': () => ScmGithubMultiOrgInstall,
  'component:replay-onboarding-alert': () => ReplayOnboardingAlert,
  'component:replay-onboarding-cta': () => ReplayOnboardingCTA,
  'component:replay-settings-alert': () => ReplaySettingsAlert,
  'component:product-unavailable-cta': () => ProductUnavailableCTA,
  'component:profiling-billing-banner': () => ProfilingBetaAlertBanner,
  'component:product-selection-availability': () => ProductSelectionAvailability,
  'component:superuser-access-category': SuperuserAccessCategory,
  'component:superuser-warning': p => <SuperuserWarning {...p} />,
  'component:superuser-warning-excluded': shouldExcludeOrg,
  'component:crons-list-page-header': () => CronsBillingBanner,
  'react-hook:route-activated': useRouteActivatedHook,
  'react-hook:use-button-tracking': useButtonTracking,
  'react-hook:use-default-max-pickable-days': useDefaultMaxPickableDays,
  'react-hook:use-max-pickable-days': useMaxPickableDays,
  'react-hook:use-get-max-retention-days': useGetMaxRetentionDays,
  'react-hook:use-metric-detector-limit': useMetricDetectorLimit,
  'react-hook:use-dashboard-dataset-retention-limit': useDashboardDatasetRetentionLimit,
  'react-hook:use-experiment': useExperiment,
  'react-hook:use-product-billing-access': useProductBillingAccess,
  'react-hook:use-replay-for-critical-flow': useReplayForCriticalFlow,
  'react-hook:use-scm-feature-meta': useScmFeatureMeta,
  'component:partnership-agreement': p => (
    <LazyLoad LazyComponent={PartnershipAgreement} {...p} />
  ),
  'component:dashboards-limit-provider': () => DashboardsLimitProvider,
  'component:data-consent-banner': () => DataConsentBanner,
  'component:data-consent-priority-learn-more': () => DataConsentPriorityLearnMore,
  'component:data-consent-org-creation-checkbox': () => DataConsentOrgCreationCheckbox,
  'component:organization-membership-settings': () => OrganizationMembershipSettingsForm,
  'component:metric-alert-quota-message': MetricAlertQuotaMessage,
  'component:metric-alert-quota-icon': MetricAlertQuotaIcon,

  /**
   * Augment disable feature hooks for augmenting with upsell interfaces
   */

  'feature-disabled:discard-groups': p => <DisabledDiscardGroup {...p} />,
  'feature-disabled:data-forwarding': p => <DisabledDataForwarding {...p} />,
  'feature-disabled:rate-limits': p => <DisabledRateLimits {...p} />,
  'feature-disabled:sso-basic': p => <DisabledAuthProvider {...p} />,
  'feature-disabled:sso-saml2': p => <DisabledAuthProvider {...p} />,
  'feature-disabled:custom-inbound-filters': p => <DisabledCustomInboundFilters {...p} />,
  'feature-disabled:discover2-sidebar-item': p =>
    typeof p.children === 'function' ? p.children(p) : p.children,
  'feature-disabled:performance-new-project': p => (
    <PerformanceNewProjectPrompt {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </PerformanceNewProjectPrompt>
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
  'feature-disabled:project-performance-score-card': p => (
    <ProjectPerformanceScoreCard {...p}>
      {typeof p.children === 'function' ? p.children(p) : p.children}
    </ProjectPerformanceScoreCard>
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
  'feature-disabled:issue-views': p => (
    <PowerFeatureHovercard
      features={['organizations:issue-views']}
      id="issue-views"
      useLearnMoreLink
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

export const registerGsAppOverrides = () =>
  entries(GETSENTRY_OVERRIDES).forEach(entry => registerOverride(...entry));
