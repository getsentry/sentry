from sentry.features.base import FeatureHandlerStrategy, OrganizationFeature, ProjectFeature
from sentry.features.manager import FeatureManager


def register_forever_feature_flags(manager: FeatureManager):
    """
    Organization Features that are part of sentry.io subscription plans
    Features here should ideally be enabled sentry/conf/server.py so that
    self-hosted and single-tenant are aligned with sentry.io. Features here
    should also be listed in SubscriptionPlanFeatureHandler in getsentry so
    that sentry.io behaves correctly.

    🚨 🚨 🚨 🚨 🚨 🚨 🚨 🚨 🚨 🚨 🚨 🚨 🚨 🚨 🚨 🚨 🚨 🚨 🚨

    ========================================================
    ===  DO NOT PUT FLAGS HERE THAT ARE NOT PERMANNATLY  ===
    === CONTROLLED BY SENTRY.IO BILLING FEATURE HANLDERS ===
    ========================================================
    """
    # No formatting so that we can keep them as single lines
    # fmt: off
    manager.add("organizations:advanced-search", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:app-store-connect-multiple", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:change-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:codecov-integration", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:commit-context", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:crash-rate-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:custom-symbol-sources", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:dashboards-basic", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:dashboards-edit", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:data-forwarding", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:discover-basic", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:discover-query", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:dynamic-sampling", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:event-attachments", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:global-views", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:incidents", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:integrations-alert-rule", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:integrations-chat-unfurl", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:integrations-codeowners", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:integrations-event-hooks", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:integrations-incident-management", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:integrations-issue-basic", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:integrations-issue-sync", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:integrations-stacktrace-link", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:integrations-ticket-rules", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:performance-view", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:relay", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:session-replay", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:sso-basic", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:sso-saml2", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:team-insights", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # NOTE: Don't add features down here! Sort them alphabetically! The order
    #       features are registered is not important.

    manager.add("projects:custom-inbound-filters", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("projects:data-forwarding", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("projects:discard-groups", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("projects:rate-limits", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("projects:servicehooks", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    # NOTE: Don't add features down here! Sort them alphabetically! The order
    #       features are registered is not important.

    # fmt: on
