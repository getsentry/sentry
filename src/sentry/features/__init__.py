from sentry.features.flags.permanent import register_forever_feature_flags

from .base import (  # NOQA
    Feature,
    FeatureHandlerStrategy,
    OrganizationFeature,
    ProjectFeature,
    ProjectPluginFeature,
    SystemFeature,
    UserFeature,
)
from .handler import *  # NOQA
from .manager import *  # NOQA

# The feature flag system provides a way to turn on or off features of Sentry.
#
# Registering a new feature:
#
# - Determine what scope your feature falls under. By convention we have
#   organization and project scopes, which map to the OrganizationFeature and
#   ProjectFeature feature objects, respectively. Scoping will provide the feature
#   with context.
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

register_forever_feature_flags(default_manager)

# No formatting so that we can keep them as single lines
# fmt: off

# Features that don't use resource scoping
default_manager.add("auth:register", SystemFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:create", SystemFeature, FeatureHandlerStrategy.INTERNAL)

# Organization scoped features that are in development or in customer trials.
default_manager.add("organizations:alert-allow-indexed", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:alert-crash-free-metrics", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:alert-filters", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:anr-analyze-frames", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:anr-improvements", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:anr-rate", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:api-auth-provider", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:api-keys", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:auto-enable-codecov", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:codecov-commit-sha-from-git-blame", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:customer-domains", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:dashboards-mep", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:dashboards-rh-widget", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:derive-code-mappings", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:device-class-synthesis", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:device-classification", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:discover", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:discover-events-rate-limit", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:ds-sliding-window", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:ds-sliding-window-org", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:dynamic-sampling-transaction-name-priority", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:enterprise-perf", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:escalating-issues", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:escalating-issues-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:grouping-stacktrace-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:grouping-title-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:grouping-tree-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:higher-ownership-limit", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:integrations-custom-scm", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:integrations-deployment", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:integrations-feature-flag-integration", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:invite-members", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:invite-members-rate-limits", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:issue-alert-fallback-targeting", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:issue-alert-incompatible-rules", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:issue-alert-preview", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:issue-alert-test-notifications", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:issue-details-tag-improvements", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:issue-list-better-priority-sort", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:issue-list-removal-action", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:issue-list-trend-sort", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:issue-platform", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:issue-search-allow-postgres-only-search", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:issue-search-use-cdc-primary", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:issue-search-use-cdc-secondary", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:issue-states", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:issue-states-auto-transition-new-ongoing", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:issue-states-auto-transition-regressed-ongoing", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:javascript-console-error-tag", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:js-sdk-dynamic-loader", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:large-debug-files", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:mep-rollout-flag", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:metric-alert-chartcuterie", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:metric-alert-threshold-period", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:metrics", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:minute-resolution-sessions", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:mobile-cpu-memory-in-transactions", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:mobile-vitals", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:monitors", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:mute-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:new-page-filter", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:new-weekly-report", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:notification-all-recipients", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:onboarding", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)  # Only enabled in sentry.io to enable onboarding flows.
default_manager.add("organizations:onboarding-heartbeat-footer", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:onboarding-project-deletion-on-back-click", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:onboarding-project-loader", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:onboarding-remove-multiselect-platform", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:onboarding-sdk-selection", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:open-ai-suggestion", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:org-roles-for-teams", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:org-subdomains", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:performance-anomaly-detection-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-chart-interpolation", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-consecutive-db-issue", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:performance-consecutive-http-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:performance-db-main-thread-detector", OrganizationFeature)
default_manager.add("organizations:performance-file-io-main-thread-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:performance-issues-all-events-tab", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-issues-compressed-assets-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:performance-issues-dev", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-issues-m-n-plus-one-db-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:performance-issues-render-blocking-assets-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:performance-issues-search", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:performance-landing-page-stats-period", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-large-http-payload-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:performance-mep-bannerless-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-mep-reintroduce-histograms", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-metrics-backed-transaction-summary", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-n-plus-one-api-calls-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:performance-new-trends", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-new-widget-designs", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-onboarding-checklist", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-slow-db-issue", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:performance-span-histogram-view", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-transaction-name-only-search", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-transaction-name-only-search-indexed", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-trendsv2-dev-only", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-use-metrics", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:performance-vitals-inp", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:profiling", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:profiling-aggregate-flamegraph", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:profiling-beta", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:profiling-flamegraphs", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:profiling-ga", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:profiling-previews", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:profiling-sampled-format", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:profiling-span-previews", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:profiling-ui-frames", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:profiling-using-transactions", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:project-event-date-limit", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:project-stats", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:related-events", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:release-comparison-performance", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:release-health-drop-sessions", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:remove-mark-reviewed", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:reprocessing-v2", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:required-email-verification", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:rule-page", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:sandbox-kill-switch", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:scim-team-roles", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:sentry-functions", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:session-replay-beta-grace", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:session-replay-ga", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:session-replay-index-subquery", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:session-replay-network-details", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:session-replay-recording-scrubbing", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:session-replay-sdk", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:session-replay-sdk-errors-only", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:session-replay-ui", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:set-grouping-config", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:slack-escape-messages", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:slack-overage-notifications", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:source-maps-debug-ids", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:sql-format", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:starfish-test-endpoint", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:starfish-view", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:streamline-targeting-context", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:symbol-sources", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:team-roles", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:transaction-metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:transaction-name-mark-scrubbed-as-sanitized", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:transaction-name-normalize", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:transaction-name-sanitization", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("organizations:u2f-superuser-form", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:use-metrics-layer", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:view-hierarchies-options-dev", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("organizations:widget-viewer-modal-minimap", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add('organizations:team-project-creation-all', OrganizationFeature, FeatureHandlerStrategy.REMOTE)
# NOTE: Don't add features down here! Add them to their specific group and sort
#       them alphabetically! The order features are registered is not important.


# Project scoped features
default_manager.add("projects:alert-filters", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("projects:minidump", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("projects:race-free-group-creation", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("projects:similarity-indexing", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("projects:similarity-indexing-v2", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("projects:similarity-view", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("projects:similarity-view-v2", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
default_manager.add("projects:suspect-resolutions", ProjectFeature, FeatureHandlerStrategy.REMOTE)
default_manager.add("projects:span-metrics-extraction", ProjectFeature, FeatureHandlerStrategy.INTERNAL)

# Project plugin features
default_manager.add("projects:plugins", ProjectPluginFeature, FeatureHandlerStrategy.INTERNAL)

# Workflow 2.0 Project features
default_manager.add("projects:auto-associate-commits-to-release", ProjectFeature, FeatureHandlerStrategy.INTERNAL)

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
