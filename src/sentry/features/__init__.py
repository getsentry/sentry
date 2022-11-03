from .base import (  # NOQA
    Feature,
    OrganizationFeature,
    ProjectFeature,
    ProjectPluginFeature,
    UserFeature,
)
from .handler import *  # NOQA
from .manager import *  # NOQA

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
default_manager.add("organizations:active-release-monitor-alpha", OrganizationFeature, True)
default_manager.add("organizations:active-release-notifications-enable", OrganizationFeature)
default_manager.add("organizations:javascript-console-error-tag", OrganizationFeature)
default_manager.add("organizations:alert-crash-free-metrics", OrganizationFeature, True)
default_manager.add("organizations:alert-filters", OrganizationFeature)
default_manager.add("organizations:api-keys", OrganizationFeature)
default_manager.add("organizations:breadcrumb-linked-event", OrganizationFeature, True)
default_manager.add("organizations:crash-rate-alerts", OrganizationFeature, True)
default_manager.add("organizations:custom-event-title", OrganizationFeature)
default_manager.add("organizations:customer-domains", OrganizationFeature, True)
default_manager.add("organizations:dashboard-custom-measurement-widgets", OrganizationFeature, True)
default_manager.add("organizations:dashboard-grid-layout", OrganizationFeature, True)
default_manager.add("organizations:dashboards-mep", OrganizationFeature, True)
default_manager.add("organizations:dashboards-releases", OrganizationFeature, True)
default_manager.add("organizations:dashboards-template", OrganizationFeature, True)
default_manager.add("organizations:dashboards-top-level-filter", OrganizationFeature, True)
default_manager.add("organizations:discover", OrganizationFeature)
default_manager.add("organizations:discover-events-rate-limit", OrganizationFeature, True)
default_manager.add("organizations:discover-metrics-baseline", OrganizationFeature, True)
default_manager.add("organizations:discover-quick-context", OrganizationFeature, True)
default_manager.add("organizations:discover-frontend-use-events-endpoint", OrganizationFeature, True)
default_manager.add("organizations:discover-query-builder-as-landing-page", OrganizationFeature, True)
default_manager.add("organizations:dynamic-sampling-deprecated", OrganizationFeature, True)
default_manager.add("organizations:dynamic-sampling-demo", OrganizationFeature, True)
default_manager.add("organizations:enterprise-perf", OrganizationFeature)
default_manager.add("organizations:grouping-stacktrace-ui", OrganizationFeature, True)
default_manager.add("organizations:grouping-title-ui", OrganizationFeature, True)
default_manager.add("organizations:grouping-tree-ui", OrganizationFeature, True)
default_manager.add("organizations:higher-ownership-limit", OrganizationFeature)
default_manager.add("organizations:invite-members", OrganizationFeature)
default_manager.add("organizations:invite-members-rate-limits", OrganizationFeature)
default_manager.add("organizations:issue-actions-v2", OrganizationFeature, True)
default_manager.add("organizations:issue-alert-incompatible-rules", OrganizationFeature, True)
default_manager.add("organizations:issue-alert-preview", OrganizationFeature, True)
default_manager.add("organizations:issue-alert-test-notifications", OrganizationFeature, True)
default_manager.add("organizations:issue-details-owners", OrganizationFeature, True)
default_manager.add("organizations:issue-details-tag-improvements", OrganizationFeature, True)
default_manager.add("organizations:issue-list-removal-action", OrganizationFeature, True)
default_manager.add("organizations:issue-list-saved-searches-v2", OrganizationFeature, True)
default_manager.add("organizations:issue-list-trend-sort", OrganizationFeature, True)
default_manager.add("organizations:issue-search-allow-postgres-only-search", OrganizationFeature, True)
default_manager.add("organizations:issue-search-use-cdc-primary", OrganizationFeature, True)
default_manager.add("organizations:issue-search-use-cdc-secondary", OrganizationFeature, True)
default_manager.add("organizations:large-debug-files", OrganizationFeature)
default_manager.add("organizations:mep-rollout-flag", OrganizationFeature, True)
default_manager.add("organizations:metric-alert-chartcuterie", OrganizationFeature, True)
default_manager.add("organizations:metric-alert-threshold-period", OrganizationFeature, True)
default_manager.add("organizations:metrics", OrganizationFeature, True)
default_manager.add("organizations:metrics-extraction", OrganizationFeature)
default_manager.add("organizations:metrics-performance-alerts", OrganizationFeature, True)
default_manager.add("organizations:metrics-performance-ui", OrganizationFeature, True)
default_manager.add("organizations:minute-resolution-sessions", OrganizationFeature)
default_manager.add("organizations:mobile-screenshots", OrganizationFeature, True)
default_manager.add("organizations:mobile-screenshot-gallery", OrganizationFeature, True)
default_manager.add("organizations:monitors", OrganizationFeature)
default_manager.add("organizations:native-stack-trace-v2", OrganizationFeature, True)
default_manager.add("organizations:new-weekly-report", OrganizationFeature, True)
default_manager.add("organizations:notification-all-recipients", OrganizationFeature, True)
default_manager.add("organizations:onboarding", OrganizationFeature)  # Only enabled in sentry.io to enable onboarding flows.
default_manager.add("organizations:org-subdomains", OrganizationFeature)
default_manager.add("organizations:performance-anomaly-detection-ui", OrganizationFeature, True)
default_manager.add("organizations:performance-autogroup-sibling-spans", OrganizationFeature, True)
default_manager.add("organizations:performance-chart-interpolation", OrganizationFeature, True)
default_manager.add("organizations:performance-dry-run-mep", OrganizationFeature, True)
default_manager.add("organizations:performance-frontend-use-events-endpoint", OrganizationFeature, True)
default_manager.add("organizations:performance-issues", OrganizationFeature, True)
default_manager.add("organizations:performance-issues-ingest", OrganizationFeature)
default_manager.add("organizations:performance-issues-post-process-group", OrganizationFeature)
default_manager.add("organizations:performance-issues-dev", OrganizationFeature, True)
default_manager.add("organizations:performance-issues-all-events-tab", OrganizationFeature, True)
default_manager.add("organizations:performance-onboarding-checklist", OrganizationFeature, True)
default_manager.add("organizations:performance-span-histogram-view", OrganizationFeature, True)
default_manager.add("organizations:performance-suspect-spans-view", OrganizationFeature, True)
default_manager.add("organizations:performance-transaction-name-only-search", OrganizationFeature, True)
default_manager.add("organizations:performance-transaction-name-only-search-indexed", OrganizationFeature, True)
default_manager.add("organizations:performance-use-metrics", OrganizationFeature, True)
default_manager.add("organizations:performance-vitals-inp", OrganizationFeature, True)
default_manager.add("organizations:performance-mep-bannerless-ui", OrganizationFeature, True)
default_manager.add("organizations:performance-mep-reintroduce-histograms", OrganizationFeature, True)
default_manager.add("organizations:profiling", OrganizationFeature)
default_manager.add("organizations:project-event-date-limit", OrganizationFeature, True)
default_manager.add("organizations:project-stats", OrganizationFeature, True)
default_manager.add("organizations:related-events", OrganizationFeature)
default_manager.add("organizations:release-committer-assignees", OrganizationFeature, True)
default_manager.add("organizations:release-comparison-performance", OrganizationFeature, True)
default_manager.add("organizations:release-health-check-metrics", OrganizationFeature, True)
default_manager.add("organizations:release-health-check-metrics-report", OrganizationFeature, True)
default_manager.add("organizations:release-health-return-metrics", OrganizationFeature, True)
default_manager.add("organizations:reprocessing-v2", OrganizationFeature)
default_manager.add("organizations:required-email-verification", OrganizationFeature, True)
default_manager.add("organizations:rule-page", OrganizationFeature)
default_manager.add("organizations:sandbox-kill-switch", OrganizationFeature, True)
default_manager.add("organizations:sentry-functions", OrganizationFeature, False)
default_manager.add("organizations:server-side-sampling-allow-incompatible-platforms", OrganizationFeature, True)
default_manager.add("organizations:session-replay", OrganizationFeature)
default_manager.add("organizations:session-replay-sdk", OrganizationFeature, True)
default_manager.add("organizations:session-replay-ui", OrganizationFeature, True)
default_manager.add("organizations:set-grouping-config", OrganizationFeature)
default_manager.add("organizations:slack-overage-notifications", OrganizationFeature, True)
default_manager.add("organizations:symbol-sources", OrganizationFeature)
default_manager.add("organizations:team-roles", OrganizationFeature, True)
default_manager.add("organizations:transaction-metrics-extraction", OrganizationFeature, True)
default_manager.add("organizations:unified-span-view", OrganizationFeature, True)
default_manager.add("organizations:use-metrics-layer", OrganizationFeature, True)
default_manager.add("organizations:weekly-email-refresh", OrganizationFeature, True)
default_manager.add("organizations:widget-library", OrganizationFeature, True)
default_manager.add("organizations:widget-viewer-modal", OrganizationFeature, True)
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
default_manager.add("organizations:server-side-sampling", OrganizationFeature)
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
default_manager.add("organizations:performance-ops-breakdown", OrganizationFeature)
default_manager.add("organizations:performance-view", OrganizationFeature)
default_manager.add("organizations:relay", OrganizationFeature)
default_manager.add("organizations:sso-basic", OrganizationFeature)
default_manager.add("organizations:sso-saml2", OrganizationFeature)
default_manager.add("organizations:team-insights", OrganizationFeature)
default_manager.add("organizations:derive-code-mappings", OrganizationFeature)

# Project scoped features
default_manager.add("projects:alert-filters", ProjectFeature)
default_manager.add("projects:custom-inbound-filters", ProjectFeature)
default_manager.add("projects:data-forwarding", ProjectFeature)
default_manager.add("projects:discard-groups", ProjectFeature)
default_manager.add("projects:minidump", ProjectFeature)
default_manager.add("projects:performance-suspect-spans-ingestion", ProjectFeature)
default_manager.add("projects:race-free-group-creation", ProjectFeature)
default_manager.add("projects:rate-limits", ProjectFeature)
default_manager.add("projects:servicehooks", ProjectFeature)
default_manager.add("projects:similarity-indexing", ProjectFeature)
default_manager.add("projects:similarity-indexing-v2", ProjectFeature)
default_manager.add("projects:similarity-view", ProjectFeature)
default_manager.add("projects:similarity-view-v2", ProjectFeature)
default_manager.add("projects:sourcemapcache-processor", ProjectFeature)
default_manager.add("projects:suspect-resolutions", ProjectFeature, True)

# Project plugin features
default_manager.add("projects:plugins", ProjectPluginFeature)

# Workflow 2.0 Project features
default_manager.add("projects:auto-associate-commits-to-release", ProjectFeature)

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
