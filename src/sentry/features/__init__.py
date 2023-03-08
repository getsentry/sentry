from .base import (  # NOQA
    Feature,
    OrganizationFeature,
    ProjectFeature,
    ProjectPluginFeature,
    UserFeature,
)
from .handler import *  # NOQA
from .manager import FeatureHandlerStrategy, FeatureManager

# The feature flag system provides a way to turn on or off features of Sentry.
#
# Registering a new feature:
#
# - Determine what scope your feature falls under. By convention we have a
#   organizations and project scope which map to the OrganizationFeature and
#   ProjectFeature feature objects. Scoping will provide the feature with
#   context.
#
#   Organization and Project scoped features will automatically be added into
#   the Organization and Project serialized representations.
#
#   Additional feature contexts can be found under the features.base module,
#   but you will typically deal with the organization or project.
#
#   NOTE: There is no currently established convention for features which do not
#         fall under these scopes. Use your best judgment for these.
#
# - Set a default for your features.
#
#   Feature defaults are configured in the sentry.conf.server.SENTRY_FEATURES
#   module variable. This is the DEFAULT value for a feature, the default may be
#   overridden by the logic in the exposed feature.manager.FeatureManager
#   instance. See the ``has`` method here for a detailed understanding of how
#   the default values is overridden.
#
# - Use your feature.
#
#   You can check if a feature is enabled using the following call:
#
#   >>> features.has('organization:my-feature', organization, actor=user)
#
#   NOTE: The second parameter is used to provide the feature context, again
#         organization and project are the most common, but it is possible that
#         other Feature objects may require more arguments.
#
#   NOTE: The actor kwarg should be passed when it's expected that the handler
#         needs context of the user.
#
#   NOTE: Features that require Snuba to function, add to the
#         `requires_snuba` tuple.

default_manager = FeatureManager()  # NOQA

# No formatting so that we can keep them as single lines
# fmt: off

# Unscoped features
default_manager.add("auth:register")
default_manager.add("organizations:create")

# Organization scoped features that are in development or in customer trials.
default_manager.add("organizations:javascript-console-error-tag", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:alert-crash-free-metrics", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:alert-filters", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:api-keys", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:crash-rate-alerts", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:custom-event-title", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:customer-domains", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:dashboards-mep", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:dashboards-template", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:discover", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:discover-events-rate-limit", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:discover-query-builder-as-landing-page", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:ds-prioritise-by-project-bias", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:ds-prioritise-by-transaction-bias", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:enterprise-perf", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:fix-source-map-cta", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:grouping-stacktrace-ui", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:grouping-title-ui", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:grouping-tree-ui", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:higher-ownership-limit", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:invite-members", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:invite-members-rate-limits", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:issue-alert-fallback-targeting", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:issue-alert-incompatible-rules", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:issue-alert-preview", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:issue-alert-test-notifications", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:issue-details-tag-improvements", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:issue-list-removal-action", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:issue-list-trend-sort", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:issue-platform", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:issue-search-allow-postgres-only-search", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:issue-search-use-cdc-primary", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:issue-search-use-cdc-secondary", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:js-sdk-dynamic-loader", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:large-debug-files", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:mep-rollout-flag", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:metric-alert-chartcuterie", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:metric-alert-threshold-period", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:metrics", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:minute-resolution-sessions", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:mobile-view-hierarchies", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:view-hierarchies-options-dev", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:anr-rate", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:monitors", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:native-stack-trace-v2", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:new-weekly-report", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:notification-all-recipients", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:onboarding", OrganizationFeature, FeatureHandlerStrategy.STATIC)  # Only enabled in sentry.io to enable onboarding flows.
default_manager.add("organizations:org-subdomains", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:performance-anomaly-detection-ui", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-chart-interpolation", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-consecutive-db-issue", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:performance-n-plus-one-api-calls-detector", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:performance-issues-compressed-assets-detector", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:performance-issues-render-blocking-assets-detector", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:performance-issues-m-n-plus-one-db-detector", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:performance-issues-dev", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-issues-all-events-tab", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-issues-search", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:performance-file-io-main-thread-detector", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:performance-onboarding-checklist", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-span-histogram-view", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-transaction-name-only-search", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-transaction-name-only-search-indexed", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-use-metrics", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-vitals-inp", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-landing-page-stats-period", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-mep-bannerless-ui", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-mep-reintroduce-histograms", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-new-widget-designs", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-metrics-backed-transaction-summary", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-slow-db-issue", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:profiling", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:profiling-flamegraphs", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:profiling-ui-frames", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:profiling-aggregate-flamegraph", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:profiling-previews", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:profiling-span-previews", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:profiling-using-transactions", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:project-event-date-limit", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:project-stats", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:related-events", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:release-comparison-performance", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:release-health-check-metrics", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:release-health-check-metrics-report", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:release-health-return-metrics", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:release-health-drop-sessions", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:reprocessing-v2", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:required-email-verification", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:rule-page", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:sandbox-kill-switch", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:scaleable-codeowners-search", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:scim-orgmember-roles", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:scim-team-roles", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:org-roles-for-teams", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:sentry-functions", OrganizationFeature, False)
default_manager.add("organizations:session-replay", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:session-replay-beta-grace", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:session-replay-ga", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:session-replay-sdk", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:session-replay-sdk-errors-only", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:session-replay-recording-scrubbing", OrganizationFeature, False)
default_manager.add("organizations:set-grouping-config", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:slack-overage-notifications", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:streamline-targeting-context", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:symbol-sources", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:team-roles", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:transaction-name-normalize", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:transaction-name-clusterer", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:transaction-name-sanitization", OrganizationFeature, False)
default_manager.add("organizations:transaction-metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:use-metrics-layer", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:widget-viewer-modal-minimap", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:u2f-superuser-form", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:commit-context-fallback", OrganizationFeature, FeatureHandlerStrategy.MANAGED)

# NOTE: Don't add features down here! Add them to their specific group and sort
#       them alphabetically! The order features are registered is not important.

# Organization Features that are part of sentry.io subscription plans
# Features here should ideally be enabled sentry/conf/server.py so that
# self-hosted and single-tenant are aligned with sentry.io. Features here should
# also be listed in SubscriptionPlanFeatureHandler in getsentry so that sentry.io
# behaves correctly.
default_manager.add("organizations:advanced-search", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:app-store-connect-multiple", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:change-alerts", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add('organizations:commit-context', OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:custom-symbol-sources", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:dashboards-basic", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:dashboards-edit", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:data-forwarding", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:discover-basic", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:discover-query", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:dynamic-sampling", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:dynamic-sampling-transaction-name-priority", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:event-attachments", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:global-views", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:incidents", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:integrations-alert-rule", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:integrations-chat-unfurl", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:integrations-codeowners", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:integrations-custom-scm", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:integrations-deployment", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:integrations-event-hooks", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:integrations-feature-flag-integration", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:integrations-incident-management", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:integrations-issue-basic", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:integrations-issue-sync", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:integrations-stacktrace-link", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:integrations-ticket-rules", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:onboarding-heartbeat-footer", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:onboarding-project-deletion-on-back-click", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:onboarding-remove-multiselect-platform", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:performance-view", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:profile-blocked-main-thread-ingest", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:profile-blocked-main-thread-ppg", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:relay", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:sso-basic", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:sso-saml2", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:source-maps-cta", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:team-insights", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:derive-code-mappings", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:derive-code-mappings-dry-run", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:codecov-stacktrace-integration", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:codecov-stacktrace-integration-v2", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:codecov-integration", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:auto-enable-codecov", OrganizationFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("organizations:codecov-commit-sha-from-git-blame", OrganizationFeature, FeatureHandlerStrategy.MANAGED)
default_manager.add("organizations:artifact-bundles", OrganizationFeature, FeatureHandlerStrategy.MANAGED)

# Project scoped features
default_manager.add("projects:alert-filters", ProjectFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("projects:custom-inbound-filters", ProjectFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("projects:data-forwarding",  ProjectFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("projects:discard-groups", ProjectFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("projects:minidump", ProjectFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("projects:race-free-group-creation", ProjectFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("projects:rate-limits", ProjectFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("projects:servicehooks", ProjectFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("projects:similarity-indexing", ProjectFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("projects:similarity-indexing-v2", ProjectFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("projects:similarity-view", ProjectFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("projects:similarity-view-v2", ProjectFeature, FeatureHandlerStrategy.STATIC)
default_manager.add("projects:suspect-resolutions", ProjectFeature, FeatureHandlerStrategy.MANAGED)

# Project plugin features
default_manager.add("projects:plugins", ProjectPluginFeature, FeatureHandlerStrategy.STATIC)

# Workflow 2.0 Project features
default_manager.add("projects:auto-associate-commits-to-release", ProjectFeature, FeatureHandlerStrategy.STATIC)

# fmt: on

# This is a gross hardcoded list, but there's no
# other sensible way to manage this right now without augmenting
# features themselves in the manager with detections like this.
requires_snuba = (
    "organizations:discover",
    "organizations:global-views",
    "organizations:incidents",
    "organizations:minute-resolution-sessions",
    "organizations:performance-view",
)

# expose public api
add = default_manager.add
entity_features = default_manager.entity_features
get = default_manager.get
has = default_manager.has
batch_has = default_manager.batch_has
all = default_manager.all
add_handler = default_manager.add_handler
add_entity_handler = default_manager.add_entity_handler
has_for_batch = default_manager.has_for_batch
