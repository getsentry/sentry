from .base import Feature, OrganizationFeature, ProjectFeature, ProjectPluginFeature  # NOQA
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

# Unscoped features
default_manager.add("auth:register")
default_manager.add("organizations:create")

# Organization scoped features
default_manager.add("organizations:advanced-search", OrganizationFeature)
default_manager.add("organizations:alert-details-redesign", OrganizationFeature, True)
default_manager.add("organizations:alert-filters", OrganizationFeature)
default_manager.add("organizations:api-keys", OrganizationFeature)
default_manager.add("organizations:app-store-connect", OrganizationFeature, True)
default_manager.add("organizations:app-store-connect-multiple", OrganizationFeature, False)
default_manager.add("organizations:boolean-search", OrganizationFeature)
default_manager.add("organizations:chart-unfurls", OrganizationFeature, True)
default_manager.add("organizations:connect-discover-and-dashboards", OrganizationFeature, True)
default_manager.add("organizations:crash-rate-alerts", OrganizationFeature, True)
default_manager.add("organizations:custom-event-title", OrganizationFeature)
default_manager.add("organizations:custom-symbol-sources", OrganizationFeature)
default_manager.add("organizations:dashboards-basic", OrganizationFeature)
default_manager.add("organizations:dashboards-edit", OrganizationFeature)
default_manager.add("organizations:data-forwarding", OrganizationFeature)
default_manager.add("organizations:discover", OrganizationFeature)
default_manager.add("organizations:discover-top-events", OrganizationFeature, True)
default_manager.add("organizations:discover-basic", OrganizationFeature)
default_manager.add("organizations:discover-query", OrganizationFeature)
default_manager.add("organizations:enterprise-perf", OrganizationFeature)
default_manager.add("organizations:event-attachments", OrganizationFeature)
default_manager.add("organizations:event-attachments-viewer", OrganizationFeature)
default_manager.add("organizations:events", OrganizationFeature)
default_manager.add("organizations:filters-and-sampling", OrganizationFeature, True)
default_manager.add("organizations:global-views", OrganizationFeature)
default_manager.add("organizations:grouping-tree-ui", OrganizationFeature, True)
default_manager.add("organizations:grouping-stacktrace-ui", OrganizationFeature, True)
default_manager.add("organizations:grouping-title-ui", OrganizationFeature, True)
default_manager.add("organizations:images-loaded-v2", OrganizationFeature)
default_manager.add("organizations:issue-percent-filters", OrganizationFeature, True)
default_manager.add("organizations:improved-search", OrganizationFeature, True)
default_manager.add("organizations:incidents", OrganizationFeature)
default_manager.add("organizations:integrations-alert-rule", OrganizationFeature)
default_manager.add("organizations:integrations-chat-unfurl", OrganizationFeature)
default_manager.add("organizations:integrations-codeowners", OrganizationFeature, True)
default_manager.add("organizations:integrations-custom-scm", OrganizationFeature, True)
default_manager.add("organizations:integrations-event-hooks", OrganizationFeature)
default_manager.add("organizations:integrations-incident-management", OrganizationFeature)
default_manager.add("organizations:integrations-issue-basic", OrganizationFeature)
default_manager.add("organizations:integrations-issue-sync", OrganizationFeature)
default_manager.add("organizations:integrations-stacktrace-link", OrganizationFeature)
default_manager.add("organizations:integrations-ticket-rules", OrganizationFeature, True)
default_manager.add("organizations:integrations-vsts-limited-scopes", OrganizationFeature)
default_manager.add("organizations:invite-members", OrganizationFeature)
default_manager.add("organizations:invite-members-rate-limits", OrganizationFeature)
default_manager.add("organizations:issue-list-trend-sort", OrganizationFeature, True)
default_manager.add("organizations:issue-percent-display", OrganizationFeature, True)
default_manager.add("organizations:issue-search-use-cdc-primary", OrganizationFeature, True)
default_manager.add("organizations:issue-search-use-cdc-secondary", OrganizationFeature, True)
default_manager.add("organizations:large-debug-files", OrganizationFeature)
default_manager.add("organizations:metric-alert-builder-aggregate", OrganizationFeature)
default_manager.add("organizations:metrics", OrganizationFeature, True)
default_manager.add("organizations:metrics-extraction", OrganizationFeature)
default_manager.add("organizations:minute-resolution-sessions", OrganizationFeature)
default_manager.add("organizations:mobile-screenshots", OrganizationFeature, True)
default_manager.add("organizations:monitors", OrganizationFeature)
default_manager.add("organizations:notification-slack-automatic", OrganizationFeature, True)
default_manager.add("organizations:onboarding", OrganizationFeature)
default_manager.add("organizations:org-subdomains", OrganizationFeature)
default_manager.add("organizations:performance-landing-widgets", OrganizationFeature, True)
default_manager.add("organizations:performance-mobile-vitals", OrganizationFeature, True)
default_manager.add("organizations:performance-ops-breakdown", OrganizationFeature)
default_manager.add("organizations:performance-tag-explorer", OrganizationFeature, True)
default_manager.add("organizations:performance-tag-page", OrganizationFeature, True)
default_manager.add("organizations:performance-events-page", OrganizationFeature, True)
default_manager.add("organizations:performance-chart-interpolation", OrganizationFeature, True)
default_manager.add("organizations:performance-suspect-spans-ingestion", OrganizationFeature)
default_manager.add("organizations:performance-suspect-spans-view", OrganizationFeature, True)
default_manager.add("organizations:performance-view", OrganizationFeature)
default_manager.add("organizations:project-transaction-threshold", OrganizationFeature, True)
default_manager.add(
    "organizations:project-transaction-threshold-override", OrganizationFeature, True
)
default_manager.add("organizations:prompt-dashboards", OrganizationFeature)
default_manager.add("organizations:prompt-additional-volume", OrganizationFeature)
default_manager.add("organizations:prompt-additional-volume-on-demand", OrganizationFeature)
default_manager.add("organizations:prompt-on-demand-orgs", OrganizationFeature)
default_manager.add("organizations:prompt-release-health-adoption", OrganizationFeature)
default_manager.add("organizations:prompt-upgrade-via-dashboards", OrganizationFeature)
default_manager.add("organizations:related-events", OrganizationFeature)
default_manager.add("organizations:relay", OrganizationFeature)
default_manager.add("organizations:release-adoption-chart", OrganizationFeature, True)
default_manager.add("organizations:release-adoption-stage", OrganizationFeature, True)
default_manager.add("organizations:release-archives", OrganizationFeature)
default_manager.add("organizations:release-comparison", OrganizationFeature, True)
default_manager.add("organizations:reprocessing-v2", OrganizationFeature)
default_manager.add("organizations:required-email-verification", OrganizationFeature, True)  # NOQA
default_manager.add("organizations:rule-page", OrganizationFeature)
default_manager.add("organizations:semver", OrganizationFeature, True)
default_manager.add("organizations:sentry-app-debugging", OrganizationFeature, True)
default_manager.add("organizations:set-grouping-config", OrganizationFeature)
default_manager.add("organizations:sso-basic", OrganizationFeature)
default_manager.add("organizations:sso-migration", OrganizationFeature)
default_manager.add("organizations:sso-rippling", OrganizationFeature)
default_manager.add("organizations:sso-saml2", OrganizationFeature)
default_manager.add("organizations:sso-scim", OrganizationFeature, True)
default_manager.add("organizations:team-insights", OrganizationFeature, True)
default_manager.add("organizations:symbol-sources", OrganizationFeature)
default_manager.add("organizations:transaction-comparison", OrganizationFeature, True)
default_manager.add("organizations:transaction-events", OrganizationFeature, True)
default_manager.add("organizations:unhandled-issue-flag", OrganizationFeature)
default_manager.add("organizations:unified-span-view", OrganizationFeature, True)

# NOTE: Don't add features down here! Add them to their specific group and sort
#       them alphabetically! The order features are registered is not important.

# Project scoped features
default_manager.add("projects:alert-filters", ProjectFeature)
default_manager.add("projects:custom-inbound-filters", ProjectFeature)
default_manager.add("projects:data-forwarding", ProjectFeature)
default_manager.add("projects:discard-groups", ProjectFeature)
default_manager.add("projects:issue-alerts-targeting", ProjectFeature)
default_manager.add("projects:minidump", ProjectFeature)
default_manager.add("projects:race-free-group-creation", ProjectFeature)
default_manager.add("projects:rate-limits", ProjectFeature)
default_manager.add("projects:servicehooks", ProjectFeature)
default_manager.add("projects:similarity-indexing", ProjectFeature)
default_manager.add("projects:similarity-indexing-v2", ProjectFeature)
default_manager.add("projects:similarity-view", ProjectFeature)
default_manager.add("projects:similarity-view-v2", ProjectFeature)

# Project plugin features
default_manager.add("projects:plugins", ProjectPluginFeature)

# This is a gross hardcoded list, but there's no
# other sensible way to manage this right now without augmenting
# features themselves in the manager with detections like this.
requires_snuba = (
    "organizations:discover",
    "organizations:events",
    "organizations:performance-view",
    "organizations:global-views",
    "organizations:incidents",
    "organizations:minute-resolution-sessions",
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
