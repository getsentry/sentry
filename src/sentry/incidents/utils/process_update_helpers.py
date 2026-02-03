import logging
from datetime import datetime, timedelta

from snuba_sdk import Column, Condition, Limit, Op

from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.search.eap.utils import add_start_end_conditions
from sentry.search.events.datasets.discover import InvalidIssueSearchQuery
from sentry.snuba.dataset import Dataset
from sentry.snuba.entity_subscription import (
    ENTITY_TIME_COLUMNS,
    EntitySubscription,
    get_entity_key_from_query_builder,
    get_entity_subscription_from_snuba_query,
)
from sentry.snuba.models import SnubaQuery
from sentry.utils import metrics, snuba_rpc

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


def get_aggregation_value_helper(subscription_update: QuerySubscriptionUpdate) -> float:
    aggregation_value = list(subscription_update["values"]["data"][0].values())[0]
    # In some cases Snuba can return a None value for an aggregation. This means
    # there were no rows present when we made the query for certain types of aggregations
    # like avg. Defaulting this to 0 for now. It might turn out that we'd prefer to skip
    # the update in the future.
    if aggregation_value is None:
        aggregation_value = 0

    return aggregation_value


def get_eap_aggregation_value(
    entity_subscription: EntitySubscription,
    subscription_update: QuerySubscriptionUpdate,
    snuba_query: SnubaQuery,
    project_ids: list[int],
    organization_id: int,
    start: datetime,
    end: datetime,
    alert_rule_id: int | None = None,
) -> float | None:
    comparison_aggregate: None | float = None
    try:
        rpc_time_series_request = entity_subscription.build_rpc_request(
            query=snuba_query.query,
            project_ids=project_ids,
            environment=snuba_query.environment,
            params={
                "organization_id": organization_id,
                "project_id": project_ids,
            },
            referrer="subscription_processor.comparison_query",
        )

        rpc_time_series_request = add_start_end_conditions(rpc_time_series_request, start, end)

        rpc_response = snuba_rpc.timeseries_rpc([rpc_time_series_request])[0]
        if len(rpc_response.result_timeseries):
            comparison_aggregate = rpc_response.result_timeseries[0].data_points[0].data

    except Exception:
        logger.exception(
            "Failed to run RPC comparison query",
            extra={
                "alert_rule_id": alert_rule_id,
                "subscription_id": subscription_update.get("subscription_id"),
                "organization_id": organization_id,
            },
        )
        return None
    return comparison_aggregate


def get_aggregation_value(
    entity_subscription: EntitySubscription,
    subscription_update: QuerySubscriptionUpdate,
    snuba_query: SnubaQuery,
    project_ids: list[int],
    organization_id: int,
    start: datetime,
    end: datetime,
    alert_rule_id: int | None = None,
) -> float | None:
    comparison_aggregate: None | float = None
    try:
        # TODO: determine whether we need to include the subscription query_extra here
        query_builder = entity_subscription.build_query_builder(
            query=snuba_query.query,
            project_ids=project_ids,
            environment=snuba_query.environment,
            params={
                "organization_id": organization_id,
                "project_id": project_ids,
                "start": start,
                "end": end,
            },
        )
        time_col = ENTITY_TIME_COLUMNS[get_entity_key_from_query_builder(query_builder)]
        query_builder.add_conditions(
            [
                Condition(Column(time_col), Op.GTE, start),
                Condition(Column(time_col), Op.LT, end),
            ]
        )
        query_builder.limit = Limit(1)
        results = query_builder.run_query(referrer="subscription_processor.comparison_query")
        comparison_aggregate = list(results["data"][0].values())[0]

    except InvalidIssueSearchQuery:
        # Queries that reference non-existent issue IDs are not useful and
        # we should help users fix them, but they're not unexpected.
        logger.info(
            "Comparison query references non-existent issue IDs",
            extra={
                "subscription_id": subscription_update.get("subscription_id"),
                "organization_id": organization_id,
            },
        )
        return None
    except Exception:
        logger.exception(
            "Failed to run comparison query",
            extra={
                "alert_rule_id": alert_rule_id,
                "subscription_id": subscription_update.get("subscription_id"),
                "organization_id": organization_id,
            },
        )
        return None
    return comparison_aggregate


def get_comparison_aggregation_value(
    subscription_update: QuerySubscriptionUpdate,
    snuba_query: SnubaQuery,
    organization_id: int,
    project_ids: list[int],
    comparison_delta: int | None = None,
    alert_rule_id: int | None = None,
) -> float | None:
    # NOTE (mifu67): we create this helper because we also use it in the new detector processing flow
    aggregation_value = get_aggregation_value_helper(subscription_update)
    if comparison_delta is None:
        return aggregation_value

    # For comparison alerts run a query over the comparison period and use it to calculate the
    # % change.
    delta = timedelta(seconds=comparison_delta)
    end = subscription_update["timestamp"] - delta
    start = end - timedelta(seconds=snuba_query.time_window)

    entity_subscription = get_entity_subscription_from_snuba_query(snuba_query, organization_id)
    dataset = Dataset(snuba_query.dataset)
    query_type = SnubaQuery.Type(snuba_query.type)

    if query_type == SnubaQuery.Type.PERFORMANCE and dataset == Dataset.EventsAnalyticsPlatform:
        comparison_aggregate = get_eap_aggregation_value(
            entity_subscription,
            subscription_update,
            snuba_query,
            project_ids,
            organization_id,
            start,
            end,
            alert_rule_id,
        )

    else:
        comparison_aggregate = get_aggregation_value(
            entity_subscription,
            subscription_update,
            snuba_query,
            project_ids,
            organization_id,
            start,
            end,
            alert_rule_id,
        )

    if not comparison_aggregate:
        metrics.incr("incidents.alert_rules.skipping_update_comparison_value_invalid")
        return None

    return (aggregation_value / comparison_aggregate) * 100


def calculate_event_date_from_update_date(update_date: datetime, time_window: int) -> datetime:
    """
    Calculates the date that an event actually happened based on the date that we
    received the update. This takes into account time window and threshold period.
    :return:
    """
    # Subscriptions label buckets by the end of the bucket, whereas discover
    # labels them by the front. This causes us an off-by-one error with event dates,
    # so to prevent this we subtract a bucket off of the date.
    return update_date - timedelta(seconds=time_window)
