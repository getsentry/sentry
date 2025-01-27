from sentry.features.base import (
    FeatureHandlerStrategy,
    OrganizationFeature,
    ProjectFeature,
    SystemFeature,
)
from sentry.features.manager import FeatureManager

# XXX: See `features/__init__.py` for documentation on how to use feature flags


def register_permanent_features(manager: FeatureManager):
    """
    These flags are permanent.

    Organization Features that are part of sentry.io subscription plans
    Features here should ideally be enabled sentry/conf/server.py so that
    self-hosted and single-tenant are aligned with sentry.io. Features here should
    also be listed in SubscriptionPlanFeatureHandler in getsentry so that sentry.io
    behaves correctly.
    """
    permanent_organization_features = {
        # Enable advanced search features, like negation and wildcard matching.
        "organizations:advanced-search": True,
        # Enable anomaly detection alerts
        "organizations:anomaly-detection-alerts": False,
        # Enable multiple Apple app-store-connect sources per project.
        "organizations:app-store-connect-multiple": False,
        # Enable change alerts for an org
        "organizations:change-alerts": True,
        # The overall flag for codecov integration, gated by plans.
        "organizations:codecov-integration": False,
        # Enable alerting based on crash free sessions/users
        "organizations:crash-rate-alerts": True,
        # Allow organizations to configure custom external symbol sources.
        "organizations:custom-symbol-sources": True,
        # Enable readonly dashboards
        "organizations:dashboards-basic": True,
        # Enable custom editable dashboards
        "organizations:dashboards-edit": True,
        # Enable data forwarding functionality for organizations.
        "organizations:data-forwarding": True,
        # Enable discover 2 basic functions
        "organizations:discover-basic": True,
        # Enable discover 2 custom queries and saved queries
        "organizations:discover-query": True,
        # Enable the new opinionated dynamic sampling
        "organizations:dynamic-sampling": False,
        # Enable attaching arbitrary files to events.
        "organizations:event-attachments": True,
        # Enable multi project selection
        "organizations:global-views": False,
        # Enable incidents feature
        "organizations:incidents": False,
        # Enable integration functionality to work with alert rules
        "organizations:integrations-alert-rule": True,
        # Enable integration functionality to work with alert rules (specifically chat integrations)
        "organizations:integrations-chat-unfurl": True,
        # Enable the API to importing CODEOWNERS for a project
        "organizations:integrations-codeowners": True,
        # Enable interface functionality to receive event hooks.
        "organizations:integrations-event-hooks": True,
        # Enable integration functionality to work with enterprise alert rules
        "organizations:integrations-enterprise-alert-rule": True,
        # Enable integration functionality to work with enterprise alert rules (specifically incident
        # management integrations)
        "organizations:integrations-enterprise-incident-management": True,
        # Enable integration functionality to work with alert rules (specifically incident
        # management integrations)
        "organizations:integrations-incident-management": True,
        # Enable integration functionality to create and link groups to issues on
        # external services.
        "organizations:integrations-issue-basic": True,
        # Enable interface functionality to synchronize groups between sentry and
        # issues on external services.
        "organizations:integrations-issue-sync": True,
        # Enable stacktrace linking
        "organizations:integrations-stacktrace-link": True,
        # Allow orgs to automatically create Tickets in Issue Alerts
        "organizations:integrations-ticket-rules": True,
        # Enable metric alert charts in email/slack
        "organizations:metric-alert-chartcuterie": False,
        # Enable Performance view
        "organizations:performance-view": True,
        # Enable profiling view
        "organizations:profiling-view": False,
        # Enable usage of external relays, for use with Relay. See
        # https://github.com/getsentry/relay.
        "organizations:relay": True,
        # Enable core remote-config backend APIs
        "organizations:remote-config": False,
        # Enable core Session Replay backend APIs
        "organizations:session-replay": False,
        # Measure usage by spans instead of transactions
        "organizations:spans-usage-tracking": False,
        # Enable basic SSO functionality, providing configurable single sign on
        # using services like GitHub / Google. This is *not* the same as the signup
        # and login with Github / Azure DevOps that sentry.io provides.
        "organizations:sso-basic": True,
        # Enable SAML2 based SSO functionality. getsentry/sentry-auth-saml2 plugin
        # must be installed to use this functionality.
        "organizations:sso-saml2": True,
        # Enable 'spans' category on the stats page
        "organizations:span-stats": False,
        # Enable team insights page
        "organizations:team-insights": True,
        # Enable setting team-level roles and receiving permissions from them
        "organizations:team-roles": True,
        # Enable the uptime monitoring features
        "organizations:uptime": True,
        # Signals that the organization supports the on demand metrics prefill.
        "organizations:on-demand-metrics-prefill": False,
        # Metrics: Enable ingestion and storage of custom metrics. See custom-metrics for UI.
        "organizations:custom-metrics": False,
        # Prefix host with organization ID when giving users DSNs (can be
        # customized with SENTRY_ORG_SUBDOMAIN_TEMPLATE) eg. o123.ingest.us.sentry.io
        "organizations:org-ingest-subdomains": False,
        # Replace the footer Sentry logo with a Sentry pride logo
        "organizations:sentry-pride-logo-footer": False,
        # Enable priority calculations using Seer's severity endpoint
        "organizations:seer-based-priority": False,
    }

    permanent_project_features = {
        # Enable data forwarding functionality for projects.
        "projects:data-forwarding": True,
        # Enable functionality for rate-limiting events on projects.
        "projects:rate-limits": True,
        # Enable functionality to specify custom inbound filters on events.
        "projects:custom-inbound-filters": False,
        # Enable functionality to discard groups.
        "projects:discard-groups": False,
        # Enable functionality to trigger service hooks upon event ingestion.
        "projects:servicehooks": False,
    }

    for org_feature, default in permanent_organization_features.items():
        manager.add(
            org_feature,
            OrganizationFeature,
            FeatureHandlerStrategy.INTERNAL,
            default=default,
            api_expose=True,
        )

    for project_feature, default in permanent_project_features.items():
        manager.add(
            project_feature,
            ProjectFeature,
            FeatureHandlerStrategy.INTERNAL,
            default=default,
            api_expose=True,
        )

    # Enable support for multiple regions, and org slug subdomains (customer-domains).
    manager.add(
        "system:multi-region",
        SystemFeature,
        FeatureHandlerStrategy.INTERNAL,
        default=False,
        api_expose=False,
    )
