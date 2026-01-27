import type {ChildrenRenderFn} from 'sentry/components/acl/feature';
import type {Guide} from 'sentry/components/assistant/types';
import type {ButtonProps} from 'sentry/components/core/button';
import type {SelectKey} from 'sentry/components/core/compactSelect';
import type {FormPanelProps} from 'sentry/components/forms/formPanel';
import type {JsonFormObject} from 'sentry/components/forms/types';
import type {ProductSelectionProps} from 'sentry/components/onboarding/productSelection';
import type DateRange from 'sentry/components/timeRangeSelector/dateRange';
import type SelectorItems from 'sentry/components/timeRangeSelector/selectorItems';
import type {SentryRouteObject} from 'sentry/router/types';
import type {DataCategory} from 'sentry/types/core';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {
  useDefaultMaxPickableDays,
  useMaxPickableDays,
} from 'sentry/utils/useMaxPickableDays';
import type {WidgetType} from 'sentry/views/dashboards/types';
import type {OrganizationStatsProps} from 'sentry/views/organizationStats';
import type {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';
import type {NavigationSection} from 'sentry/views/settings/types';

import type {Integration, IntegrationProvider} from './integrations';
import type {RouteContextInterface} from './legacyReactRouter';
import type {Member, Organization, OrgRole} from './organization';
import type {User} from './user';

// XXX(epurkhiser): A Note about `_`.
//
// We add the `_: any` type int our hooks list to stop
// typescript from doing too much type tightening. We should absolutely revisit
// this in the future because all callbacks _should_ be allowed to be
// functions, but doing so causes some unexpected issues and makes typescript
// not happy. We still get a huge advantage of typing just by having each hook
// type here however.

/**
 * The Hooks type mapping is the master interface for all external Hooks into
 * the sentry frontend application.
 */
export interface Hooks
  extends RouteHooks,
    ComponentHooks,
    CustomizationHooks,
    AnalyticsHooks,
    FeatureDisabledHooks,
    InterfaceChromeHooks,
    OnboardingHooks,
    SettingsHooks,
    FeatureSpecificHooks,
    ReactHooks,
    CallbackHooks {
  _: any;
}

export type HookName = keyof Hooks;

/**
 * Route hooks.
 */
type RouteHooks = {
  'routes:legacy-organization-redirects': RouteObjectHook;
  'routes:root': RouteObjectHook;
  'routes:subscription-settings': RouteObjectHook;
};

type AiSetupConfigrationProps = {
  event: Event;
  group: Group;
  project: Project;
};

type AiSetupDataConsentProps = {
  groupId: string;
};

/**
 * Component specific hooks for DateRange and SelectorItems
 * These components have plan specific overrides in getsentry
 */
type DateRangeProps = React.ComponentProps<typeof DateRange>;

type SelectorItemsProps = React.ComponentProps<typeof SelectorItems>;

type MemberListHeaderProps = {
  members: Member[];
  organization: Organization;
};

type DisabledCustomSymbolSources = {
  children: React.ReactNode;
  organization: Organization;
};

type DisabledMemberTooltipProps = {children: React.ReactNode};

type DashboardHeadersProps = {organization: Organization};

type ReplayListPageHeaderProps = {children?: React.ReactNode};
type ReplayOnboardingAlertProps = {children: React.ReactNode};
type ReplayOnboardingCTAProps = {children: React.ReactNode; organization: Organization};
type ProductUnavailableCTAProps = {organization: Organization};

type ProfilingBetaAlertBannerProps = {
  organization: Organization;
};

type ContinuousProfilingBetaAlertBannerProps = {
  organization: Organization;
};

type ContinuousProfilingBillingRequirementBannerProps = {
  project: Project;
};

type CronsBillingBannerProps = {
  organization: Organization;
};

type OrganizationHeaderProps = {
  organization: Organization;
};

type ProductSelectionAvailabilityProps = Omit<ProductSelectionProps, 'disabledProducts'>;

type DateRangeQueryLimitFooterProps = {
  description: string;
  source: string;
};

type FirstPartyIntegrationAlertProps = {
  integrations: Integration[];
  hideCTA?: boolean;
  wrapWithContainer?: boolean;
};

type FirstPartyIntegrationAdditionalCTAProps = {
  integrations: Integration[];
};

type AttemptCloseAttemptProps = {
  handleRemoveAccount: () => void;
  organizationSlugs: string[];
};

type CodecovLinkProps = {
  organization: Organization;
};

type GuideUpdateCallback = (nextGuide: Guide | null, opts: {dismissed?: boolean}) => void;

type MonitorCreatedCallback = (organization: Organization) => void;

type CronsOnboardingPanelProps = {children: React.ReactNode};

export type ParntershipAgreementType = 'standard' | 'partner_presence';
export type PartnershipAgreementProps = {
  agreements: ParntershipAgreementType[];
  partnerDisplayName: string;
  onSubmitSuccess?: () => void;
  organizationSlug?: string;
};

export type MembershipSettingsProps = {
  forms: readonly JsonFormObject[];
  jsonFormSettings: Omit<
    FormPanelProps,
    'highlighted' | 'fields' | 'additionalFieldProps'
  >;
};
export type GithubInstallationInstallButtonProps = {
  handleSubmit: (e: React.MouseEvent) => void;
  hasSCMMultiOrg: boolean;
  installationID: SelectKey;
  isSaving: boolean;
};

type DashboardLimitProviderProps = {
  children:
    | ((limitData: {
        dashboardsLimit: number;
        hasReachedDashboardLimit: boolean;
        isLoading: boolean;
        limitMessage: React.ReactNode | null;
      }) => React.ReactNode)
    | React.ReactNode;
};

/**
 * Component wrapping hooks
 */
type ComponentHooks = {
  'component:ai-setup-configuration': () => React.ComponentType<AiSetupConfigrationProps>;
  'component:ai-setup-data-consent': () => React.ComponentType<AiSetupDataConsentProps> | null;
  'component:codecov-integration-settings-link': () => React.ComponentType<CodecovLinkProps>;
  'component:confirm-account-close': () => React.ComponentType<AttemptCloseAttemptProps>;
  'component:continuous-profiling-beta-banner': () => React.ComponentType<ContinuousProfilingBetaAlertBannerProps>;
  'component:continuous-profiling-beta-sdk-banner': () => React.ComponentType;
  'component:continuous-profiling-billing-requirement-banner': () => React.ComponentType<ContinuousProfilingBillingRequirementBannerProps>;
  'component:crons-list-page-header': () => React.ComponentType<CronsBillingBannerProps>;
  'component:crons-onboarding-panel': () => React.ComponentType<CronsOnboardingPanelProps>;
  'component:dashboards-header': () => React.ComponentType<DashboardHeadersProps>;
  'component:dashboards-limit-provider': () => React.ComponentType<DashboardLimitProviderProps>;
  'component:data-consent-banner': () => React.ComponentType<{source: string}> | null;
  'component:data-consent-org-creation-checkbox': () => React.ComponentType | null;
  'component:data-consent-priority-learn-more': () => React.ComponentType | null;
  'component:disabled-custom-symbol-sources': () => React.ComponentType<DisabledCustomSymbolSources>;
  'component:disabled-member': () => React.ComponentType;
  'component:disabled-member-tooltip': () => React.ComponentType<DisabledMemberTooltipProps>;
  'component:enhanced-org-stats': () => React.ComponentType<OrganizationStatsProps>;
  'component:first-party-integration-additional-cta': () => React.ComponentType<FirstPartyIntegrationAdditionalCTAProps>;
  'component:first-party-integration-alert': () => React.ComponentType<FirstPartyIntegrationAlertProps>;
  'component:header-date-page-filter-upsell-footer': () => React.ComponentType<DateRangeQueryLimitFooterProps>;
  'component:header-date-range': () => React.ComponentType<DateRangeProps>;
  'component:header-selector-items': () => React.ComponentType<SelectorItemsProps>;
  'component:insights-date-range-query-limit-footer': () => React.ComponentType;
  'component:member-list-header': () => React.ComponentType<MemberListHeaderProps>;
  'component:metric-alert-quota-icon': React.ComponentType;
  'component:metric-alert-quota-message': React.ComponentType;
  'component:org-stats-banner': () => React.ComponentType<DashboardHeadersProps>;
  'component:org-stats-profiling-banner': () => React.ComponentType;
  'component:organization-header': () => React.ComponentType<OrganizationHeaderProps>;
  'component:organization-membership-settings': () => React.ComponentType<MembershipSettingsProps>;
  'component:partnership-agreement': React.ComponentType<PartnershipAgreementProps>;
  'component:product-selection-availability': () => React.ComponentType<ProductSelectionAvailabilityProps>;
  'component:product-unavailable-cta': () => React.ComponentType<ProductUnavailableCTAProps>;
  'component:profiling-billing-banner': () => React.ComponentType<ProfilingBetaAlertBannerProps>;
  'component:replay-list-page-header': () => React.ComponentType<ReplayListPageHeaderProps> | null;
  'component:replay-onboarding-alert': () => React.ComponentType<ReplayOnboardingAlertProps>;
  'component:replay-onboarding-cta': () => React.ComponentType<ReplayOnboardingCTAProps>;
  'component:replay-settings-alert': () => React.ComponentType | null;
  'component:scm-multi-org-install-button': () => React.ComponentType<GithubInstallationInstallButtonProps>;
  'component:seer-beta-closing-alert': () => React.ComponentType;
  'component:superuser-access-category': React.ComponentType<any>;
  'component:superuser-warning': React.ComponentType<any>;
  'component:superuser-warning-excluded': SuperuserWarningExcluded;
};

/**
 * Customization hooks are advanced hooks that return render-prop style
 * components the allow for specific customizations of components.
 *
 * These are very similar to the component wrapping hooks
 */
type CustomizationHooks = {
  'integrations:feature-gates': IntegrationsFeatureGatesHook;
  'member-invite-button:customization': InviteButtonCustomizationHook;
  'member-invite-modal:customization': InviteModalCustomizationHook;
  'member-invite-modal:organization-roles': (organization: Organization) => OrgRole[];
};

/**
 * Analytics / tracking / and operational metrics backend hooks.
 */
type AnalyticsHooks = {
  'analytics:init-user': AnalyticsInitUser;
  'analytics:raw-track-event': AnalyticsRawTrackEvent;
  'metrics:event': MetricsEvent;
};

/**
 * feature-disabled:<feature-flag> hooks return components that will be
 * rendered in place for Feature components when the feature is not enabled.
 */
export type FeatureDisabledHooks = {
  'feature-disabled:alert-wizard-performance': FeatureDisabledHook;
  'feature-disabled:alerts-page': FeatureDisabledHook;
  'feature-disabled:codecov-integration-setting': FeatureDisabledHook;
  'feature-disabled:custom-inbound-filters': FeatureDisabledHook;
  'feature-disabled:dashboards-edit': FeatureDisabledHook;
  'feature-disabled:dashboards-page': FeatureDisabledHook;
  'feature-disabled:dashboards-sidebar-item': FeatureDisabledHook;
  'feature-disabled:data-forwarding': FeatureDisabledHook;
  'feature-disabled:discard-groups': FeatureDisabledHook;
  'feature-disabled:discover-saved-query-create': FeatureDisabledHook;
  'feature-disabled:discover2-page': FeatureDisabledHook;
  'feature-disabled:discover2-sidebar-item': FeatureDisabledHook;
  'feature-disabled:grid-editable-actions': FeatureDisabledHook;
  'feature-disabled:issue-views': FeatureDisabledHook;
  'feature-disabled:open-discover': FeatureDisabledHook;
  'feature-disabled:open-in-discover': FeatureDisabledHook;
  'feature-disabled:performance-new-project': FeatureDisabledHook;
  'feature-disabled:performance-page': FeatureDisabledHook;
  'feature-disabled:profiling-page': FeatureDisabledHook;
  'feature-disabled:profiling-sidebar-item': FeatureDisabledHook;
  'feature-disabled:project-performance-score-card': FeatureDisabledHook;
  'feature-disabled:rate-limits': FeatureDisabledHook;
  'feature-disabled:replay-sidebar-item': FeatureDisabledHook;
  'feature-disabled:sso-basic': FeatureDisabledHook;
  'feature-disabled:sso-saml2': FeatureDisabledHook;
};

/**
 * Interface chrome hooks.
 */
type InterfaceChromeHooks = {
  footer: GenericComponentHook;
  'help-modal:footer': HelpModalFooterHook;
  'sidebar:billing-status': GenericOrganizationComponentHook;
  'sidebar:help-menu': GenericOrganizationComponentHook;
  'sidebar:item-label': SidebarItemLabelHook;
  'sidebar:organization-dropdown-menu': GenericOrganizationComponentHook;
  'sidebar:organization-dropdown-menu-bottom': GenericOrganizationComponentHook;
  'sidebar:try-business': SidebarTryBusinessHook;
};

/**
 * Onboarding experience hooks
 */
type OnboardingHooks = {
  'onboarding:block-hide-sidebar': () => boolean;
  'onboarding:targeted-onboarding-header': (opts: {source: string}) => React.ReactNode;
};

/**
 * Settings navigation hooks.
 */
type SettingsHooks = {
  'settings:organization-navigation': OrganizationSettingsHook;
  'settings:organization-navigation-config': SettingsConfigHook;
};

/**
 * Feature Specific Hooks
 */
interface FeatureSpecificHooks extends SpendVisibilityHooks {}

/**
 * Hooks related to Spend Visibitlity
 * (i.e. Per-Project Spike Protection + Spend Allocations)
 */
type SpendVisibilityHooks = {
  'spend-visibility:spike-protection-project-settings': GenericProjectComponentHook;
};

/**
 * Hooks that are actually React Hooks as well
 */
type ReactHooks = {
  'react-hook:route-activated': (
    props: RouteContextInterface
  ) => React.ContextType<typeof RouteAnalyticsContext>;
  'react-hook:use-button-tracking': (props: ButtonProps) => () => void;
  'react-hook:use-dashboard-dataset-retention-limit': (props: {
    dataset: WidgetType;
  }) => number;
  'react-hook:use-default-max-pickable-days': typeof useDefaultMaxPickableDays;
  'react-hook:use-get-max-retention-days': () => number | undefined;
  'react-hook:use-max-pickable-days': typeof useMaxPickableDays;
  'react-hook:use-metric-detector-limit': () => {
    detectorCount: number;
    detectorLimit: number;
    hasReachedLimit: boolean;
    isError: boolean;
    isLoading: boolean;
  };
  'react-hook:use-product-billing-access': (product: DataCategory) => boolean;
};

/**
 * Callback hooks.
 * These hooks just call a function that has no return value
 * and perform some sort of callback logic
 */
type CallbackHooks = {
  'callback:on-guide-update': GuideUpdateCallback;
  'callback:on-monitor-created': MonitorCreatedCallback;
};

/**
 * Renders a React node with no props
 */
type GenericComponentHook = () => React.ReactNode;

/**
 * A route hook provides an injection point for a list of routes.
 */
type RouteObjectHook = () => SentryRouteObject;

/**
 * Receives an organization object and should return a React node.
 */
type GenericOrganizationComponentHook = (opts: {
  organization: Organization;
}) => React.ReactNode;

/**
 * Receives a project object and should return a React node.
 */
type GenericProjectComponentHook = (opts: {project: Project}) => React.ReactNode;

/**
 * A FeatureDisabledHook returns a react element when a feature is not enabled.
 */
type FeatureDisabledHook = (opts: {
  /**
   * Children can either be a node, or a function that accepts a renderDisabled prop containing
   * a function/component to render when the feature is not enabled.
   */
  children: React.ReactNode | ChildrenRenderFn;
  /**
   * The list of features that are controlled by this hook.
   */
  features: string[];
  /**
   * Weather the feature is or is not enabled.
   */
  hasFeature: boolean;

  /**
   * The organization that is associated to this feature.
   */
  organization: Organization;

  /**
   * The project that is associated to this feature.
   */
  project?: Project;
}) => React.ReactNode;

/**
 * Called to check if the superuser warning should be excluded for the given organization.
 */
type SuperuserWarningExcluded = (organization: Organization | null) => boolean;

/**
 * Called when the app is mounted.
 */
type AnalyticsInitUser = (user: User) => void;

/**
 * Trigger analytics tracking in the hook store.
 */
type AnalyticsRawTrackEvent = (
  data: {
    /**
     * Arbitrary data to track
     */
    [key: string]: any;
    /**
     * The Reload event key.
     */
    eventKey: string;

    /**
     * The Amplitude event name. Set to null if event should not go to Amplitude.
     */
    eventName: string | null;
    /**
     * Organization to pass in. If full org object not available, pass in just the Id.
     * If no org, pass in null.
     */
    organization: Organization | string | null;
  },
  options?: {
    /**
     * An arbitrary function to map the parameters to new parameters
     */
    mapValuesFn?: (params: Record<string, any>) => Record<string, any>;
    /**
     * If true, starts an analytics session. This session can be used
     * to construct funnels. The start of the funnel should have
     * startSession set to true.
     */
    startSession?: boolean;

    /**
     * Optional unix timestamp
     */
    time?: number;
  }
) => void;

/**
 * Trigger recording a metric in the hook store.
 */
type MetricsEvent = (
  /**
   * Metric name
   */
  name: string,
  /**
   * Value to record for this metric
   */
  value: number,
  /**
   * An additional tags object
   */
  tags?: Record<PropertyKey, unknown>
) => void;

/**
 * Provides additional navigation components
 */
type OrganizationSettingsHook = (organization: Organization) => React.ReactElement;

/**
 * Provides additional setting configurations
 */
type SettingsConfigHook = (organization: Organization) => NavigationSection;

/**
 * Each sidebar label is wrapped with this hook, to allow sidebar item
 * augmentation.
 */
type SidebarItemLabelHook = () => React.ComponentType<{
  /**
   * The item label being wrapped
   */
  children: React.ReactNode;
  /**
   * The key of the item label currently being rendered. If no id is provided
   * the hook will have no effect.
   */
  id?: string;
}>;

/**
 * Returns an additional list of sidebar items.
 */
type SidebarTryBusinessHook = (opts: {organization: Organization}) => React.ReactNode;

/**
 * Provides augmentation of the help modal footer
 */
type HelpModalFooterHook = (opts: {
  closeModal: () => void;
  organization: Organization;
}) => React.ReactNode;

/**
 * The DecoratedIntegrationFeature differs from the IntegrationFeature as it is
 * expected to have been transformed into marked up content.
 */
type DecoratedIntegrationFeature = {
  /**
   * Marked up description
   */
  description: React.ReactNode;
  featureGate: string;
};

type IntegrationFeatureGroup = {
  /**
   * The list of features within this group
   */
  features: DecoratedIntegrationFeature[];
  /**
   * Weather the group has all of the features enabled within this group
   * or not.
   */
  hasFeatures: boolean;
};

type FeatureGateSharedProps = {
  /**
   * The list of features, typically this is provided by the backend.
   */
  features: DecoratedIntegrationFeature[];
  /**
   * Organization of the integration we're querying feature gate details for.
   */
  organization: Organization;
};

type IntegrationFeaturesProps = FeatureGateSharedProps & {
  /**
   * The children function which will be provided with gating details.
   */
  children: (opts: {
    /**
     * Is the integration disabled for installation because of feature gating?
     */
    disabled: boolean;
    /**
     * The translated reason that the integration is disabled.
     */
    disabledReason: React.ReactNode;
    /**
     * Features grouped based on specific gating criteria (for example, in
     * sentry.io this is features grouped by plans).
     */
    gatedFeatureGroups: IntegrationFeatureGroup[];
    /**
     * This is the list of features which have *not* been gated in any way.
     */
    ungatedFeatures: DecoratedIntegrationFeature[];
  }) => React.ReactElement;
};

type IntegrationFeatureListProps = FeatureGateSharedProps & {
  provider: Pick<IntegrationProvider, 'key'>;
};

/**
 * The integration features gate hook provides components to customize
 * integration feature lists.
 */
type IntegrationsFeatureGatesHook = () => {
  /**
   * This component renders the list of integration features.
   */
  FeatureList: React.ComponentType<IntegrationFeatureListProps>;
  /**
   * This is a render-prop style component that given a set of integration
   * features will call the children function with gating details about the
   * features.
   */
  IntegrationFeatures: React.ComponentType<IntegrationFeaturesProps>;
};

/**
 * Invite Button customization allows for a render-props component to replace
 * or intercept props of the button element.
 */
type InviteButtonCustomizationHook = () => React.ComponentType<{
  children: (opts: {
    /**
     * Whether the Invite Members button is active or not
     */
    disabled: boolean;
    onTriggerModal: () => void;
    /**
     * Whether to display a message that new members must be registered via SSO
     */
    isSsoRequired?: boolean;
  }) => React.ReactElement;
  onTriggerModal: () => void;
  organization: Organization;
}>;
/**
 * Invite Modal customization allows for a render-prop component to add
 * additional react elements into the modal, and add invite-send middleware.
 */
type InviteModalCustomizationHook = () => React.ComponentType<{
  children: (opts: {
    /**
     * Indicates that the modal's send invites button should be enabled and
     * invites may currently be sent.
     */
    canSend: boolean;
    /**
     * Indicates that the account has reached the maximum member limit. Future invitations
     * are limited to Billing roles
     */
    isOverMemberLimit: boolean;
    /**
     * Trigger sending invites
     */
    sendInvites: () => void;
    /**
     * Additional react elements to render in the header of the modal, just
     * under the description.
     */
    headerInfo?: React.ReactNode;
  }) => React.ReactElement;
  /**
   * When the children's sendInvites renderProp is called, this will also be
   * triggered.
   */
  onSendInvites: () => void;
  /**
   * The organization that members will be invited to.
   */
  organization: Organization;
  /**
   * Indicates if clicking 'send invites' will immediately send invites, or
   * would just create invite requests.
   */
  willInvite: boolean;
}>;
