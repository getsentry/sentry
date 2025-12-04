from django.conf import settings

from sentry import options
from sentry.models.organization import Organization


def get_max_metric_alert_subscriptions(organization: Organization) -> int:
    if organization.id in options.get("metric_alerts.extended_max_subscriptions_orgs") and (
        extended_max_specs := options.get("metric_alerts.extended_max_subscriptions")
    ):
        return extended_max_specs

    return settings.MAX_QUERY_SUBSCRIPTIONS_PER_ORG
