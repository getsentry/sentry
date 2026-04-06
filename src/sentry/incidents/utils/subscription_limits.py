from __future__ import annotations

from django.conf import settings

from sentry import features, options
from sentry.models.organization import Organization
from sentry.snuba.dataset import Dataset


def is_metric_subscription_allowed(dataset: str, organization: Organization) -> bool:
    """
    Check whether the given organization is allowed to have a metric alert
    subscription for the given dataset.

    Returns True if allowed, False if the organization lacks the required features
    (e.g. after a plan downgrade).
    """
    has_incidents = features.has("organizations:incidents", organization)
    if dataset == Dataset.Events.value:
        return has_incidents

    if dataset == Dataset.Transactions.value:
        return has_incidents and features.has("organizations:performance-view", organization)

    if dataset == Dataset.EventsAnalyticsPlatform.value:
        return has_incidents and features.has("organizations:visibility-explore-view", organization)

    if dataset == Dataset.PerformanceMetrics.value:
        return features.has("organizations:on-demand-metrics-extraction", organization)

    # Other datasets (e.g. Metrics/sessions) aren't gated here but probably should be.
    return True


def get_max_metric_alert_subscriptions(organization: Organization) -> int:
    if organization.id in options.get("metric_alerts.extended_max_subscriptions_orgs") and (
        extended_max_specs := options.get("metric_alerts.extended_max_subscriptions")
    ):
        return extended_max_specs

    return settings.MAX_QUERY_SUBSCRIPTIONS_PER_ORG
