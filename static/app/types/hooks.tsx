import {Route, RouteComponentProps} from 'react-router';

import {ChildrenRenderFn} from 'sentry/components/acl/feature';
import DateRange from 'sentry/components/organizations/timeRangeSelector/dateRange';
import SelectorItems from 'sentry/components/organizations/timeRangeSelector/dateRange/selectorItems';
import SidebarItem from 'sentry/components/sidebar/sidebarItem';
import {
  Integration,
  IntegrationProvider,
  Member,
  Organization,
  Project,
  User,
} from 'sentry/types';
import {ExperimentKey} from 'sentry/types/experiments';
import {NavigationItem, NavigationSection} from 'sentry/views/settings/types';

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
export type Hooks = {_: any} & RouteHooks &
  ComponentHooks &
  CustomizationHooks &
  AnalyticsHooks &
  FeatureDisabledHooks &
  InterfaceChromeHooks &
  OnboardingHooks &
  SettingsHooks;

export type HookName = keyof Hooks;

/**
 * Route hooks.
 */
export type RouteHooks = {
  routes: RoutesHook;
  'routes:admin': RoutesHook;
  'routes:api': RoutesHook;
  'routes:organization': RoutesHook;
};

/**
 * Component specific hooks for DateRange and SelectorItems
 * These components have plan specific overrides in getsentry
 */
type DateRangeProps = React.ComponentProps<typeof DateRange>;

type SelectorItemsProps = React.ComponentProps<typeof SelectorItems>;

type GlobalNotificationProps = {className: string; organization?: Organization};

type DisabledMemberViewProps = RouteComponentProps<{orgId: string}, {}>;

type MemberListHeaderProps = {
  members: Member[];
  organization: Organization;
};

type DisabledAppStoreConnectMultiple = {organization: Organization};
type DisabledCustomSymbolSources = {organization: Organization};

type DisabledMemberTooltipProps = {children: React.ReactNode};

type DashboardHeadersProps = {organization: Organization};

type CodeOwnersHeaderProps = {
  addCodeOwner: () => void;
  handleRequest: () => void;
};

type FirstPartyIntegrationAlertProps = {
  integrations: Integration[];
  hideCTA?: boolean;
  wrapWithContainer?: boolean;
};

type FirstPartyIntegrationAdditionalCTAProps = {
  integrations: Integration[];
};

/**
 * Component wrapping hooks
 */
export type ComponentHooks = {
  'component:codeowners-header': () => React.ComponentType<CodeOwnersHeaderProps>;
  'component:dashboards-header': () => React.ComponentType<DashboardHeadersProps>;
  'component:disabled-app-store-connect-multiple': () => React.ComponentType<DisabledAppStoreConnectMultiple>;
  'component:disabled-custom-symbol-sources': () => React.ComponentType<DisabledCustomSymbolSources>;
  'component:disabled-member': () => React.ComponentType<DisabledMemberViewProps>;
  'component:disabled-member-tooltip': () => React.ComponentType<DisabledMemberTooltipProps>;
  'component:first-party-integration-additional-cta': () => React.ComponentType<FirstPartyIntegrationAdditionalCTAProps>;
  'component:first-party-integration-alert': () => React.ComponentType<FirstPartyIntegrationAlertProps>;
  'component:global-notifications': () => React.ComponentType<GlobalNotificationProps>;
  'component:header-date-range': () => React.ComponentType<DateRangeProps>;
  'component:header-selector-items': () => React.ComponentType<SelectorItemsProps>;
  'component:member-list-header': () => React.ComponentType<MemberListHeaderProps>;
  'component:org-stats-banner': () => React.ComponentType<DashboardHeadersProps>;
};

/**
 * Customization hooks are advanced hooks that return render-prop style
 * components the allow for specific customizations of components.
 *
 * These are very similar to the component wrapping hooks
 */
export type CustomizationHooks = {
  'integrations:feature-gates': IntegrationsFeatureGatesHook;
  'member-invite-modal:customization': InviteModalCustomizationHook;
};

/**
 * Analytics / tracking / and operational metrics backend hooks.
 */
export type AnalyticsHooks = {
  // TODO(scefali): Below are deprecated and should be replaced
  'analytics:event': LegacyAnalyticsEvent;
  'analytics:init-user': AnalyticsInitUser;
  'analytics:log-experiment': AnalyticsLogExperiment;
  'analytics:track-adhoc-event': AnalyticsTrackAdhocEvent;

  'analytics:track-event': AnalyticsTrackEvent;
  'analytics:track-event-v2': AnalyticsTrackEventV2;
  'metrics:event': MetricsEvent;
};

/**
 * feature-disabled:<feature-flag> hooks return components that will be
 * rendered in place for Feature components when the feature is not enabled.
 */
export type FeatureDisabledHooks = {
  'feature-disabled:alert-wizard-performance': FeatureDisabledHook;
  'feature-disabled:alerts-page': FeatureDisabledHook;
  'feature-disabled:configure-distributed-tracing': FeatureDisabledHook;
  'feature-disabled:custom-inbound-filters': FeatureDisabledHook;
  'feature-disabled:dashboards-edit': FeatureDisabledHook;
  'feature-disabled:dashboards-page': FeatureDisabledHook;
  'feature-disabled:dashboards-sidebar-item': FeatureDisabledHook;
  'feature-disabled:data-forwarding': FeatureDisabledHook;
  'feature-disabled:discard-groups': FeatureDisabledHook;
  'feature-disabled:discover-page': FeatureDisabledHook;
  'feature-disabled:discover-saved-query-create': FeatureDisabledHook;
  'feature-disabled:discover-sidebar-item': FeatureDisabledHook;
  'feature-disabled:discover2-page': FeatureDisabledHook;
  'feature-disabled:discover2-sidebar-item': FeatureDisabledHook;
  'feature-disabled:events-page': FeatureDisabledHook;
  'feature-disabled:events-sidebar-item': FeatureDisabledHook;
  'feature-disabled:grid-editable-actions': FeatureDisabledHook;
  'feature-disabled:incidents-sidebar-item': FeatureDisabledHook;
  'feature-disabled:open-discover': FeatureDisabledHook;
  'feature-disabled:open-in-discover': FeatureDisabledHook;
  'feature-disabled:performance-new-project': FeatureDisabledHook;
  'feature-disabled:performance-page': FeatureDisabledHook;
  'feature-disabled:performance-quick-trace': FeatureDisabledHook;
  'feature-disabled:performance-sidebar-item': FeatureDisabledHook;
  'feature-disabled:profiling-page': FeatureDisabledHook;
  'feature-disabled:profiling-sidebar-item': FeatureDisabledHook;
  'feature-disabled:project-performance-score-card': FeatureDisabledHook;
  'feature-disabled:project-selector-all-projects': FeatureDisabledHook;
  'feature-disabled:project-selector-checkbox': FeatureDisabledHook;
  'feature-disabled:rate-limits': FeatureDisabledHook;
  'feature-disabled:relay': FeatureDisabledHook;
  'feature-disabled:sso-basic': FeatureDisabledHook;
  'feature-disabled:sso-saml2': FeatureDisabledHook;
  'feature-disabled:trace-view-link': FeatureDisabledHook;
};

/**
 * Interface chrome hooks.
 */
export type InterfaceChromeHooks = {
  footer: GenericComponentHook;
  'help-modal:footer': HelpModalFooterHook;
  'organization:header': OrganizationHeaderComponentHook;
  'sidebar:bottom-items': SidebarBottomItemsHook;
  'sidebar:help-menu': GenericOrganizationComponentHook;
  'sidebar:item-label': SidebarItemLabelHook;
  'sidebar:item-override': SidebarItemOverrideHook;
  'sidebar:organization-dropdown-menu': GenericOrganizationComponentHook;
  'sidebar:organization-dropdown-menu-bottom': GenericOrganizationComponentHook;
};

/**
 * Onboarding experience hooks
 */
export type OnboardingHooks = {
  'onboarding-wizard:skip-help': GenericOrganizationComponentHook;
  'onboarding:extra-chrome': GenericComponentHook;
};

/**
 * Settings navigation hooks.
 */
export type SettingsHooks = {
  'settings:api-navigation-config': SettingsItemsHook;
  'settings:organization-navigation': OrganizationSettingsHook;
  'settings:organization-navigation-config': SettingsConfigHook;
};

/**
 * Renders a React node with no props
 */
type GenericComponentHook = () => React.ReactNode;

/**
 * A route hook provides an injection point for a list of routes.
 */
type RoutesHook = () => Route[];

/**
 * Receives an organization object and should return a React node.
 */
type GenericOrganizationComponentHook = (opts: {
  organization: Organization;
}) => React.ReactNode;

// TODO(ts): We should correct the organization header hook to conform to the
// GenericOrganizationComponentHook, passing org as a prop object, not direct
// as the only argument.
type OrganizationHeaderComponentHook = (org: Organization) => React.ReactNode;

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
 * Called when the app is mounted.
 */
type AnalyticsInitUser = (user: User) => void;

/**
 * Trigger analytics tracking in the hook store.
 */
type AnalyticsTrackEvent = (opts: {
  /**
   * Arbitrary data to track
   */
  [key: string]: any;
  /**
   * The key used to identify the event.
   */
  eventKey: string;
  /**
   * The English string used as the name of the event.
   */
  eventName: string;
  organization_id: string | number | null;
}) => void;

/**
 * Trigger analytics tracking in the hook store.
 */
type AnalyticsTrackEventV2 = (
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
    organization: Organization | null;
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
  }
) => void;

/**
 * Trigger ad hoc analytics tracking in the hook store.
 */
type AnalyticsTrackAdhocEvent = (opts: {
  /**
   * Arbitrary data to track
   */
  [key: string]: any;
  /**
   * The key used to identify the event.
   */
  eventKey: string;
}) => void;

/**
 * Trigger experiment observed logging.
 */
type AnalyticsLogExperiment = (opts: {
  /**
   * The experiment key
   */
  key: ExperimentKey;
  /**
   * The organization. Must be provided for organization experiments.
   */
  organization?: Organization;
}) => void;

/**
 * Trigger analytics tracking in the hook store.
 *
 * Prefer using `analytics:track-event` or `analytics:track-adhock-event`.
 *
 * @deprecated This is the legacy interface.
 */
type LegacyAnalyticsEvent = (
  /**
   * The key used to identify the event.
   */
  name: string,
  /**
   * Arbitrary data to track
   */
  data: {[key: string]: any}
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
  tags?: object
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
 * Provides additional setting navigation items
 */
type SettingsItemsHook = (organization?: Organization) => NavigationItem[];

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

type SidebarItemOverrideHook = () => React.ComponentType<{
  /**
   * The item label being wrapped
   */
  children: (props: Partial<React.ComponentProps<typeof SidebarItem>>) => React.ReactNode;
  id?: string;
}>;

type SidebarProps = Pick<
  React.ComponentProps<typeof SidebarItem>,
  'orientation' | 'collapsed' | 'hasPanel'
>;

/**
 * Returns an additional list of sidebar items.
 */
type SidebarBottomItemsHook = (
  opts: SidebarProps & {organization: Organization}
) => React.ReactNode;

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
  IntegrationDirectoryFeatureList: React.ComponentType<IntegrationFeatureListProps>;
  IntegrationDirectoryFeatures: React.ComponentType<IntegrationFeaturesProps>;
  /**
   * This is a render-prop style component that given a set of integration
   * features will call the children function with gating details about the
   * features.
   */
  IntegrationFeatures: React.ComponentType<IntegrationFeaturesProps>;
};

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
