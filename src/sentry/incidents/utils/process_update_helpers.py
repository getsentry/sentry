import logging

from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.utils import metrics

logger = logging.getLogger(__name__)
"""
We pull these methods out of the subscription processor to be used by the
workflow engine data condition handlers.
"""

# NOTE (mifu67): this is set to None in the subscription processor code and doesn't
# seem to be used. Maybe we don't need the logic gated by it?
CRASH_RATE_ALERT_MINIMUM_THRESHOLD: int | None = None


def get_crash_rate_alert_metrics_aggregation_value_helper(
    subscription_update: QuerySubscriptionUpdate,
) -> float | None:
    """
    Handles validation and extraction of Crash Rate Alerts subscription updates values over
    metrics dataset.
    The subscription update looks like
    [
        {'project_id': 8, 'tags[5]': 6, 'count': 2.0, 'crashed': 1.0}
    ]
    - `count` represents sessions or users sessions that were started, hence to get the crash
    free percentage, we would need to divide number of crashed sessions by that number,
    and subtract that value from 1. This is also used when CRASH_RATE_ALERT_MINIMUM_THRESHOLD is
    set in the sense that if the minimum threshold is greater than the session count,
    then the update is dropped. If the minimum threshold is not set then the total sessions
    count is just ignored
    - `crashed` represents the total sessions or user counts that crashed.
    """
    row = subscription_update["values"]["data"][0]
    total_session_count = row.get("count", 0)
    crash_count = row.get("crashed", 0)

    if total_session_count == 0:
        metrics.incr("incidents.alert_rules.ignore_update_no_session_data")
        return None

    if CRASH_RATE_ALERT_MINIMUM_THRESHOLD is not None:
        min_threshold = int(CRASH_RATE_ALERT_MINIMUM_THRESHOLD)
        if total_session_count < min_threshold:
            metrics.incr("incidents.alert_rules.ignore_update_count_lower_than_min_threshold")
            return None

    aggregation_value: int = round((1 - crash_count / total_session_count) * 100, 3)

    return aggregation_value


def get_aggregation_value_helper(
    subscription_update: QuerySubscriptionUpdate, rule: AlertRule | None = None
) -> float:

    aggregation_value = list(subscription_update["values"]["data"][0].values())[0]
    print("AGGREGATION VALUE", aggregation_value)
    # In some cases Snuba can return a None value for an aggregation. This means
    # there were no rows present when we made the query for certain types of aggregations
    # like avg. Defaulting this to 0 for now. It might turn out that we'd prefer to skip
    # the update in the future.
    if aggregation_value is None:
        if rule:
            logger.info(
                "Setting aggregation value to 0",
                extra={
                    "result": subscription_update,
                    "aggregation_value": aggregation_value,
                    "rule_id": rule.id,
                },
            )
        aggregation_value = 0

    return aggregation_value


def get_aggregation_value_helper_group_by(
    subscription_update: QuerySubscriptionUpdate,
) -> list[tuple[str, float]]:
    """
    Processes subscription updates that contain grouped data, returning a list of tuples
    containing the group by key's value and the count.

    Example input:
    {"version": 3, "payload": {"subscription_id": "0/a138ae380b2911f0a0efd256082ad19d",
    "request": {"query": "MATCH (events) SELECT count() AS `count` BY <any_key>"},
    "result": {"data": [{"<any_key>": "value1", "count": 1}, {"<any_key>": "value2", "count": 2}]}}}

    Returns a list of tuples: [("value1", 1), ("value2", 2)]
    """
    data = subscription_update["values"]["data"]
    if not data:
        return 0

    # Get the group by key by finding the key that isn't "count"
    group_by_key = next(key for key in data[0].keys() if key != "count")
    return [(row[group_by_key], row["count"]) for row in data]
