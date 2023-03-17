from enum import Enum


class OrganizationFeature:
    pass


class ProjectFeature:
    pass


class ProjectPluginFeature:
    pass


class FeatureManager:
    def __init__(self):
        self.features = {}
        pass

    def add(self, name, feature=None, strategy=False):
        self.features[name] = strategy


class FeatureHandlerStrategy(Enum):
    """
    This controls whether the feature flag is evaluated statically,
    or if it's managed by a remote feature flag service.
    See https://develop.sentry.dev/feature-flags/
    """

    INTERNAL = 1
    """Handle the feature using a constant or logic within python"""
    REMOTE = 2
    """Handle the feature using a remote flag management service"""


default_manager_new = FeatureManager()  # NOQA

# No formatting so that we can keep them as single lines
# fmt: off

# Unscoped features
default_manager_new.add("auth:register")
default_manager_new.add("organizations:create")

# Organization scoped features that are in development or in customer trials.
default_manager_new.add("organizations:javascript-console-error-tag", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:alert-crash-free-metrics", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:alert-filters", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:api-keys", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:crash-rate-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:custom-event-title", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:customer-domains", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:dashboards-mep", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:dashboards-rh-widget", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:dashboards-template", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:discover", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:discover-events-rate-limit", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:discover-query-builder-as-landing-page", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:ds-prioritise-by-project-bias", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:ds-prioritise-by-transaction-bias", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:enterprise-perf", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:grouping-stacktrace-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:grouping-title-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:grouping-tree-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:higher-ownership-limit", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:invite-members", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:invite-members-rate-limits", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:issue-alert-fallback-targeting", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:issue-alert-incompatible-rules", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:issue-alert-preview", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:issue-alert-test-notifications", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:issue-details-tag-improvements", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:issue-list-removal-action", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:issue-list-trend-sort", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:issue-platform", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:issue-search-allow-postgres-only-search", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:issue-search-use-cdc-primary", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:issue-search-use-cdc-secondary", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:js-sdk-dynamic-loader", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:large-debug-files", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:mep-rollout-flag", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:metric-alert-chartcuterie", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:metric-alert-threshold-period", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:metrics", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:minute-resolution-sessions", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:view-hierarchies-options-dev", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:anr-rate", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:device-classification", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:monitors", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:native-stack-trace-v2", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:new-weekly-report", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:notification-actions", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:notification-all-recipients", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:onboarding", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)  # Only enabled in sentry.io to enable onboarding flows.
default_manager_new.add("organizations:org-subdomains", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:performance-anomaly-detection-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-chart-interpolation", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-consecutive-db-issue", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:performance-consecutive-http-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:performance-n-plus-one-api-calls-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:performance-issues-compressed-assets-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:performance-issues-render-blocking-assets-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:performance-issues-m-n-plus-one-db-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:performance-issues-dev", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-issues-all-events-tab", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-issues-search", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:performance-file-io-main-thread-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:performance-onboarding-checklist", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-span-histogram-view", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-transaction-name-only-search", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-transaction-name-only-search-indexed", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-use-metrics", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-vitals-inp", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-landing-page-stats-period", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-mep-bannerless-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-mep-reintroduce-histograms", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-new-widget-designs", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-metrics-backed-transaction-summary", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-slow-db-issue", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:profiling", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:profiling-flamegraphs", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:profiling-ui-frames", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:profiling-aggregate-flamegraph", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:profiling-previews", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:profiling-span-previews", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:profiling-using-transactions", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:project-event-date-limit", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:project-stats", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:related-events", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:release-comparison-performance", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:release-health-check-metrics", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:release-health-check-metrics-report", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:release-health-return-metrics", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:release-health-drop-sessions", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:reprocessing-v2", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:required-email-verification", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:rule-page", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:sandbox-kill-switch", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:scaleable-codeowners-search", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:scim-team-roles", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:org-roles-for-teams", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:sentry-functions", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:session-replay", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:session-replay-ui", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:session-replay-beta-grace", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:session-replay-ga", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:session-replay-sdk", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:session-replay-sdk-errors-only", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:session-replay-recording-scrubbing", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:set-grouping-config", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:slack-overage-notifications", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:streamline-targeting-context", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:symbol-sources", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:team-roles", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:transaction-name-normalize", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:transaction-name-mark-scrubbed-as-sanitized", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:transaction-name-clusterer", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:transaction-name-clusterer-2x", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:transaction-name-sanitization", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:transaction-metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:use-metrics-layer", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:widget-viewer-modal-minimap", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:u2f-superuser-form", OrganizationFeature, FeatureHandlerStrategy.REMOTE)

# NOTE: Don't add features down here! Add them to their specific group and sort
#       them alphabetically! The order features are registered is not important.

# Organization Features that are part of sentry.io subscription plans
# Features here should ideally be enabled sentry/conf/server.py so that
# self-hosted and single-tenant are aligned with sentry.io. Features here should
# also be listed in SubscriptionPlanFeatureHandler in getsentry so that sentry.io
# behaves correctly.
default_manager_new.add("organizations:advanced-search", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:app-store-connect-multiple", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:change-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add('organizations:commit-context', OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:custom-symbol-sources", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:dashboards-basic", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:dashboards-edit", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:data-forwarding", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:discover-basic", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:discover-query", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:dynamic-sampling", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:dynamic-sampling-transaction-name-priority", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:escalating-issues", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:event-attachments", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:global-views", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:incidents", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:integrations-alert-rule", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:integrations-chat-unfurl", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:integrations-codeowners", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:integrations-custom-scm", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:integrations-deployment", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:integrations-event-hooks", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:integrations-feature-flag-integration", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:integrations-incident-management", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:integrations-issue-basic", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:integrations-issue-sync", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:integrations-stacktrace-link", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:integrations-ticket-rules", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:onboarding-heartbeat-footer", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:onboarding-heartbeat-footer-with-view-sample-error", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:onboarding-project-deletion-on-back-click", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:onboarding-remove-multiselect-platform", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:performance-view", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:profile-blocked-main-thread-ingest", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:profile-blocked-main-thread-ppg", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:relay", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:sso-basic", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:sso-saml2", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:source-maps-cta", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:source-maps-debug-ids", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:team-insights", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:derive-code-mappings", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:codecov-stacktrace-integration", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:codecov-stacktrace-integration-v2", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:codecov-integration", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:auto-enable-codecov", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("organizations:codecov-commit-sha-from-git-blame", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager_new.add("organizations:artifact-bundles", OrganizationFeature, FeatureHandlerStrategy.REMOTE)

# Project scoped features
default_manager_new.add("projects:alert-filters", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("projects:custom-inbound-filters", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("projects:data-forwarding", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("projects:discard-groups", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("projects:minidump", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("projects:race-free-group-creation", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("projects:rate-limits", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("projects:servicehooks", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("projects:similarity-indexing", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("projects:similarity-indexing-v2", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("projects:similarity-view", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("projects:similarity-view-v2", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager_new.add("projects:suspect-resolutions", ProjectFeature, FeatureHandlerStrategy.REMOTE)

# Project plugin features
default_manager_new.add("projects:plugins", ProjectPluginFeature, FeatureHandlerStrategy.INTERNAL)

# Workflow 2.0 Project features
default_manager_new.add("projects:auto-associate-commits-to-release", ProjectFeature, FeatureHandlerStrategy.INTERNAL)




default_manager = FeatureManager()  # NOQA

# No formatting so that we can keep them as single lines
# fmt: off

# Unscoped features
# default_manager.add("auth:register")
# default_manager.add("organizations:create")

# Organization scoped features that are in development or in customer trials.
default_manager.add("organizations:javascript-console-error-tag", OrganizationFeature)
default_manager.add("organizations:alert-crash-free-metrics", OrganizationFeature, True)
default_manager.add("organizations:alert-filters", OrganizationFeature)
default_manager.add("organizations:api-keys", OrganizationFeature)
default_manager.add("organizations:crash-rate-alerts", OrganizationFeature)
default_manager.add("organizations:custom-event-title", OrganizationFeature)
default_manager.add("organizations:customer-domains", OrganizationFeature, True)
default_manager.add("organizations:dashboards-mep", OrganizationFeature, True)
default_manager.add("organizations:dashboards-rh-widget", OrganizationFeature, True)
default_manager.add("organizations:dashboards-template", OrganizationFeature, True)
default_manager.add("organizations:discover", OrganizationFeature)
default_manager.add("organizations:discover-events-rate-limit", OrganizationFeature, True)
default_manager.add("organizations:discover-query-builder-as-landing-page", OrganizationFeature, True)
default_manager.add("organizations:ds-prioritise-by-project-bias", OrganizationFeature)
default_manager.add("organizations:ds-prioritise-by-transaction-bias", OrganizationFeature)
default_manager.add("organizations:enterprise-perf", OrganizationFeature)
default_manager.add("organizations:grouping-stacktrace-ui", OrganizationFeature, True)
default_manager.add("organizations:grouping-title-ui", OrganizationFeature, True)
default_manager.add("organizations:grouping-tree-ui", OrganizationFeature, True)
default_manager.add("organizations:higher-ownership-limit", OrganizationFeature)
default_manager.add("organizations:invite-members", OrganizationFeature)
default_manager.add("organizations:invite-members-rate-limits", OrganizationFeature)
default_manager.add("organizations:issue-alert-fallback-targeting", OrganizationFeature, True)
default_manager.add("organizations:issue-alert-incompatible-rules", OrganizationFeature, True)
default_manager.add("organizations:issue-alert-preview", OrganizationFeature, True)
default_manager.add("organizations:issue-alert-test-notifications", OrganizationFeature, True)
default_manager.add("organizations:issue-details-tag-improvements", OrganizationFeature, True)
default_manager.add("organizations:issue-list-removal-action", OrganizationFeature, True)
default_manager.add("organizations:issue-list-trend-sort", OrganizationFeature, True)
default_manager.add("organizations:issue-platform", OrganizationFeature, True)
default_manager.add("organizations:issue-search-allow-postgres-only-search", OrganizationFeature, True)
default_manager.add("organizations:issue-search-use-cdc-primary", OrganizationFeature, True)
default_manager.add("organizations:issue-search-use-cdc-secondary", OrganizationFeature, True)
default_manager.add("organizations:js-sdk-dynamic-loader", OrganizationFeature, True)
default_manager.add("organizations:large-debug-files", OrganizationFeature)
default_manager.add("organizations:mep-rollout-flag", OrganizationFeature, True)
default_manager.add("organizations:metric-alert-chartcuterie", OrganizationFeature)
default_manager.add("organizations:metric-alert-threshold-period", OrganizationFeature, True)
default_manager.add("organizations:metrics", OrganizationFeature, True)
default_manager.add("organizations:metrics-extraction", OrganizationFeature)
default_manager.add("organizations:minute-resolution-sessions", OrganizationFeature)
default_manager.add("organizations:view-hierarchies-options-dev", OrganizationFeature, True)
default_manager.add("organizations:anr-rate", OrganizationFeature, True)
default_manager.add("organizations:device-classification", OrganizationFeature, True)
default_manager.add("organizations:monitors", OrganizationFeature, True)
default_manager.add("organizations:native-stack-trace-v2", OrganizationFeature, True)
default_manager.add("organizations:new-weekly-report", OrganizationFeature, True)
default_manager.add("organizations:notification-actions", OrganizationFeature, True)
default_manager.add("organizations:notification-all-recipients", OrganizationFeature, True)
default_manager.add("organizations:onboarding", OrganizationFeature)  # Only enabled in sentry.io to enable onboarding flows.
default_manager.add("organizations:org-subdomains", OrganizationFeature)
default_manager.add("organizations:performance-anomaly-detection-ui", OrganizationFeature, True)
default_manager.add("organizations:performance-chart-interpolation", OrganizationFeature, True)
default_manager.add("organizations:performance-consecutive-db-issue", OrganizationFeature)
default_manager.add("organizations:performance-consecutive-http-detector", OrganizationFeature)
default_manager.add("organizations:performance-n-plus-one-api-calls-detector", OrganizationFeature)
default_manager.add("organizations:performance-issues-compressed-assets-detector", OrganizationFeature)
default_manager.add("organizations:performance-issues-render-blocking-assets-detector", OrganizationFeature)
default_manager.add("organizations:performance-issues-m-n-plus-one-db-detector", OrganizationFeature)
default_manager.add("organizations:performance-issues-dev", OrganizationFeature, True)
default_manager.add("organizations:performance-issues-all-events-tab", OrganizationFeature, True)
default_manager.add("organizations:performance-issues-search", OrganizationFeature)
default_manager.add("organizations:performance-file-io-main-thread-detector", OrganizationFeature)
default_manager.add("organizations:performance-onboarding-checklist", OrganizationFeature, True)
default_manager.add("organizations:performance-span-histogram-view", OrganizationFeature, True)
default_manager.add("organizations:performance-transaction-name-only-search", OrganizationFeature, True)
default_manager.add("organizations:performance-transaction-name-only-search-indexed", OrganizationFeature, True)
default_manager.add("organizations:performance-use-metrics", OrganizationFeature, True)
default_manager.add("organizations:performance-vitals-inp", OrganizationFeature, True)
default_manager.add("organizations:performance-landing-page-stats-period", OrganizationFeature, True)
default_manager.add("organizations:performance-mep-bannerless-ui", OrganizationFeature, True)
default_manager.add("organizations:performance-mep-reintroduce-histograms", OrganizationFeature, True)
default_manager.add("organizations:performance-new-widget-designs", OrganizationFeature, True)
default_manager.add("organizations:performance-metrics-backed-transaction-summary", OrganizationFeature, True)
default_manager.add("organizations:performance-slow-db-issue", OrganizationFeature)
default_manager.add("organizations:profiling", OrganizationFeature)
default_manager.add("organizations:profiling-flamegraphs", OrganizationFeature, True)
default_manager.add("organizations:profiling-ui-frames", OrganizationFeature, True)
default_manager.add("organizations:profiling-aggregate-flamegraph", OrganizationFeature, True)
default_manager.add("organizations:profiling-previews", OrganizationFeature, True)
default_manager.add("organizations:profiling-span-previews", OrganizationFeature, True)
default_manager.add("organizations:profiling-using-transactions", OrganizationFeature, True)
default_manager.add("organizations:project-event-date-limit", OrganizationFeature, True)
default_manager.add("organizations:project-stats", OrganizationFeature, True)
default_manager.add("organizations:related-events", OrganizationFeature)
default_manager.add("organizations:release-comparison-performance", OrganizationFeature, True)
default_manager.add("organizations:release-health-check-metrics", OrganizationFeature, True)
default_manager.add("organizations:release-health-check-metrics-report", OrganizationFeature, True)
default_manager.add("organizations:release-health-return-metrics", OrganizationFeature, True)
default_manager.add("organizations:release-health-drop-sessions", OrganizationFeature, True)
default_manager.add("organizations:reprocessing-v2", OrganizationFeature)
default_manager.add("organizations:required-email-verification", OrganizationFeature, True)
default_manager.add("organizations:rule-page", OrganizationFeature)
default_manager.add("organizations:sandbox-kill-switch", OrganizationFeature, True)
default_manager.add("organizations:scaleable-codeowners-search", OrganizationFeature)
default_manager.add("organizations:scim-team-roles", OrganizationFeature, True)
default_manager.add("organizations:org-roles-for-teams", OrganizationFeature, True)
default_manager.add("organizations:sentry-functions", OrganizationFeature, False)
default_manager.add("organizations:session-replay", OrganizationFeature)
default_manager.add("organizations:session-replay-ui", OrganizationFeature)
default_manager.add("organizations:session-replay-beta-grace", OrganizationFeature, True)
default_manager.add("organizations:session-replay-ga", OrganizationFeature, True)
default_manager.add("organizations:session-replay-sdk", OrganizationFeature, True)
default_manager.add("organizations:session-replay-sdk-errors-only", OrganizationFeature, True)
default_manager.add("organizations:session-replay-recording-scrubbing", OrganizationFeature, False)
default_manager.add("organizations:set-grouping-config", OrganizationFeature)
default_manager.add("organizations:slack-overage-notifications", OrganizationFeature, True)
default_manager.add("organizations:streamline-targeting-context", OrganizationFeature, True)
default_manager.add("organizations:symbol-sources", OrganizationFeature)
default_manager.add("organizations:team-roles", OrganizationFeature)
default_manager.add("organizations:transaction-name-normalize", OrganizationFeature)
default_manager.add("organizations:transaction-name-mark-scrubbed-as-sanitized", OrganizationFeature)
default_manager.add("organizations:transaction-name-clusterer", OrganizationFeature)
default_manager.add("organizations:transaction-name-clusterer-2x", OrganizationFeature)
default_manager.add("organizations:transaction-name-sanitization", OrganizationFeature, False)
default_manager.add("organizations:transaction-metrics-extraction", OrganizationFeature)
default_manager.add("organizations:use-metrics-layer", OrganizationFeature, True)
default_manager.add("organizations:widget-viewer-modal-minimap", OrganizationFeature, True)
default_manager.add("organizations:u2f-superuser-form", OrganizationFeature, True)

# NOTE: Don't add features down here! Add them to their specific group and sort
#       them alphabetically! The order features are registered is not important.

# Organization Features that are part of sentry.io subscription plans
# Features here should ideally be enabled sentry/conf/server.py so that
# self-hosted and single-tenant are aligned with sentry.io. Features here should
# also be listed in SubscriptionPlanFeatureHandler in getsentry so that sentry.io
# behaves correctly.
default_manager.add("organizations:advanced-search", OrganizationFeature)
default_manager.add("organizations:app-store-connect-multiple", OrganizationFeature)
default_manager.add("organizations:change-alerts", OrganizationFeature)
default_manager.add('organizations:commit-context', OrganizationFeature)
default_manager.add("organizations:custom-symbol-sources", OrganizationFeature)
default_manager.add("organizations:dashboards-basic", OrganizationFeature)
default_manager.add("organizations:dashboards-edit", OrganizationFeature)
default_manager.add("organizations:data-forwarding", OrganizationFeature)
default_manager.add("organizations:discover-basic", OrganizationFeature)
default_manager.add("organizations:discover-query", OrganizationFeature)
default_manager.add("organizations:dynamic-sampling", OrganizationFeature)
default_manager.add("organizations:dynamic-sampling-transaction-name-priority", OrganizationFeature, True)
default_manager.add("organizations:escalating-issues", OrganizationFeature)
default_manager.add("organizations:event-attachments", OrganizationFeature)
default_manager.add("organizations:global-views", OrganizationFeature)
default_manager.add("organizations:incidents", OrganizationFeature)
default_manager.add("organizations:integrations-alert-rule", OrganizationFeature)
default_manager.add("organizations:integrations-chat-unfurl", OrganizationFeature)
default_manager.add("organizations:integrations-codeowners", OrganizationFeature)
default_manager.add("organizations:integrations-custom-scm", OrganizationFeature)
default_manager.add("organizations:integrations-deployment", OrganizationFeature)
default_manager.add("organizations:integrations-event-hooks", OrganizationFeature)
default_manager.add("organizations:integrations-feature-flag-integration", OrganizationFeature)
default_manager.add("organizations:integrations-incident-management", OrganizationFeature)
default_manager.add("organizations:integrations-issue-basic", OrganizationFeature)
default_manager.add("organizations:integrations-issue-sync", OrganizationFeature)
default_manager.add("organizations:integrations-stacktrace-link", OrganizationFeature)
default_manager.add("organizations:integrations-ticket-rules", OrganizationFeature)
default_manager.add("organizations:onboarding-heartbeat-footer", OrganizationFeature, True)
default_manager.add("organizations:onboarding-heartbeat-footer-with-view-sample-error", OrganizationFeature, True)
default_manager.add("organizations:onboarding-project-deletion-on-back-click", OrganizationFeature, True)
default_manager.add("organizations:onboarding-remove-multiselect-platform", OrganizationFeature, True)
default_manager.add("organizations:performance-view", OrganizationFeature)
default_manager.add("organizations:profile-blocked-main-thread-ingest", OrganizationFeature)
default_manager.add("organizations:profile-blocked-main-thread-ppg", OrganizationFeature)
default_manager.add("organizations:relay", OrganizationFeature)
default_manager.add("organizations:sso-basic", OrganizationFeature)
default_manager.add("organizations:sso-saml2", OrganizationFeature)
default_manager.add("organizations:source-maps-cta", OrganizationFeature, True)
default_manager.add("organizations:source-maps-debug-ids", OrganizationFeature, True)
default_manager.add("organizations:team-insights", OrganizationFeature)
default_manager.add("organizations:derive-code-mappings", OrganizationFeature)
default_manager.add("organizations:codecov-stacktrace-integration", OrganizationFeature, True)
default_manager.add("organizations:codecov-stacktrace-integration-v2", OrganizationFeature, True)
default_manager.add("organizations:codecov-integration", OrganizationFeature)
default_manager.add("organizations:auto-enable-codecov", OrganizationFeature)
default_manager.add("organizations:codecov-commit-sha-from-git-blame", OrganizationFeature, True)
default_manager.add("organizations:artifact-bundles", OrganizationFeature, True)

# Project scoped features
default_manager.add("projects:alert-filters", ProjectFeature)
default_manager.add("projects:custom-inbound-filters", ProjectFeature)
default_manager.add("projects:data-forwarding", ProjectFeature)
default_manager.add("projects:discard-groups", ProjectFeature)
default_manager.add("projects:minidump", ProjectFeature)
default_manager.add("projects:race-free-group-creation", ProjectFeature)
default_manager.add("projects:rate-limits", ProjectFeature)
default_manager.add("projects:servicehooks", ProjectFeature)
default_manager.add("projects:similarity-indexing", ProjectFeature)
default_manager.add("projects:similarity-indexing-v2", ProjectFeature)
default_manager.add("projects:similarity-view", ProjectFeature)
default_manager.add("projects:similarity-view-v2", ProjectFeature)
default_manager.add("projects:suspect-resolutions", ProjectFeature, True)

# Project plugin features
default_manager.add("projects:plugins", ProjectPluginFeature)

# Workflow 2.0 Project features
default_manager.add("projects:auto-associate-commits-to-release", ProjectFeature)

# fmt: on


def shim_feature_strategy(entity_feature_strategy):
    """
    Shim layer for old API to register a feature until all the features have been converted
    """
    if entity_feature_strategy is True:
        return FeatureHandlerStrategy.REMOTE
    elif entity_feature_strategy is False:
        return FeatureHandlerStrategy.INTERNAL
    return entity_feature_strategy


def test_ff_migration():
    for name, strategy in default_manager.features.items():
        assert shim_feature_strategy(strategy) == default_manager_new.features[name]
