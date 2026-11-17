import logging
from datetime import datetime, timedelta

from snuba_sdk import Column, Condition, Limit, Op

from sentry.exceptions import InvalidSearchQuery
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.search.eap.utils import add_start_end_conditions
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

BASELINE_QUERY_REFERRER = "subscription_processor.comparison_query"


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

    evaluation_value: int = round((1 - crash_count / total_session_count) * 100, 3)

    return evaluation_value


def coerce_aggregation_value(value: object, *, none_defaults_to_zero: bool = False) -> float | None:
    """
    Normalize a Snuba/EAP aggregate to float | None.

    Subscription and comparison queries can return None, empty strings, or other
    non-numeric values for some aggregates (e.g. max/min with no matching rows).
    Callers should skip the update when this returns None rather than doing type
    checks later.
    """
    if value is None:
        return 0.0 if none_defaults_to_zero else None

    if isinstance(value, bool):
        # bool is a subclass of int; treat explicitly before numeric checks.
        return float(value)

    if isinstance(value, (int, float)):
        return float(value)

    # Snuba occasionally returns empty/non-numeric strings for max/min-style
    # aggregates when no matching rows exist. Skip those updates rather than
    # crashing in math.isnan() or coercing to 0 (which can false-trigger alerts).
    if isinstance(value, str):
        if value.strip() == "":
            return None
        try:
            return float(value)
        except ValueError:
            return None

    return None


def get_aggregation_value_helper(subscription_update: QuerySubscriptionUpdate) -> float | None:
    evaluation_value = list(subscription_update["values"]["data"][0].values())[0]
    # In some cases Snuba can return a None value for an aggregation. This means
    # there were no rows present when we made the query for certain types of aggregations
    # like avg. Defaulting this to 0 for now. It might turn out that we'd prefer to skip
    # the update in the future.
    return coerce_aggregation_value(evaluation_value, none_defaults_to_zero=True)


def _is_eap_query(snuba_query: SnubaQuery) -> bool:
    return (
        SnubaQuery.Type(snuba_query.type) == SnubaQuery.Type.PERFORMANCE
        and Dataset(snuba_query.dataset) == Dataset.EventsAnalyticsPlatform
    )


def _run_eap_query(
    subscription: EntitySubscription,
    snuba_query: SnubaQuery,
    org_id: int,
    project_ids: list[int],
    window_start: datetime,
    window_end: datetime,
    referrer: str,
) -> object:
    rpc_time_series_request = subscription.build_rpc_request(
        query=snuba_query.query,
        project_ids=project_ids,
        environment=snuba_query.environment,
        params={"organization_id": org_id, "project_id": project_ids},
        referrer=referrer,
    )
    rpc_time_series_request = add_start_end_conditions(
        rpc_time_series_request, window_start, window_end
    )

    rpc_response = snuba_rpc.timeseries_rpc([rpc_time_series_request])[0]
    if not rpc_response.result_timeseries:
        return None
    return rpc_response.result_timeseries[0].data_points[0].data


def _run_snql_query(
    subscription: EntitySubscription,
    snuba_query: SnubaQuery,
    org_id: int,
    project_ids: list[int],
    window_start: datetime,
    window_end: datetime,
    referrer: str,
) -> object:
    # TODO: determine whether we need to include the subscription query_extra here
    query_builder = subscription.build_query_builder(
        query=snuba_query.query,
        project_ids=project_ids,
        environment=snuba_query.environment,
        params={
            "organization_id": org_id,
            "project_id": project_ids,
            "start": window_start,
            "end": window_end,
        },
    )
    time_col = ENTITY_TIME_COLUMNS[get_entity_key_from_query_builder(query_builder)]
    query_builder.add_conditions(
        [
            Condition(Column(time_col), Op.GTE, window_start),
            Condition(Column(time_col), Op.LT, window_end),
        ]
    )
    query_builder.limit = Limit(1)
    results = query_builder.run_query(referrer=referrer)
    return list(results["data"][0].values())[0]


def run_query_for_window(
    snuba_query: SnubaQuery,
    subscription_id: str,
    org_id: int,
    project_ids: list[int],
    window_start: datetime,
    window_end: datetime,
    referrer: str,
) -> float | None:
    """
    Run the detector's query over `[start, end)` and return its value, or None if the query fails
    or returns no usable value. EAP queries go through the RPC time-series endpoint, everything else
    through SnQL.
    """
    subscription = get_entity_subscription_from_snuba_query(snuba_query, org_id)
    logger_extra = {
        "subscription_id": subscription_id,
        "organization_id": org_id,
        "dataset": snuba_query.dataset,
        "referrer": referrer,
    }

    try:
        run_query = _run_eap_query if _is_eap_query(snuba_query) else _run_snql_query
        value = run_query(
            subscription, snuba_query, org_id, project_ids, window_start, window_end, referrer
        )
    except InvalidSearchQuery:
        # Invalid search syntax, or a filter on issue IDs that don't exist - either way, it's user
        # error, so log rather than capturing an exception
        logger.info("Metric detector query has an invalid search query", extra=logger_extra)
        return None
    except Exception:
        logger.exception("Failed to run metric detector query", extra=logger_extra)
        return None

    return coerce_aggregation_value(value)


def get_comparison_aggregation_value(
    subscription_update: QuerySubscriptionUpdate,
    snuba_query: SnubaQuery,
    organization_id: int,
    project_ids: list[int],
    comparison_delta: int | None = None,
) -> float | None:
    # NOTE (mifu67): we create this helper because we also use it in the new detector processing flow
    evaluation_value = get_aggregation_value_helper(subscription_update)
    if evaluation_value is None:
        return None
    if comparison_delta is None:
        return evaluation_value

    # For comparison alerts run a query over the comparison period and use it to calculate the
    # % change.
    delta = timedelta(seconds=comparison_delta)
    end = subscription_update["timestamp"] - delta
    start = end - timedelta(seconds=snuba_query.time_window)

    baseline_value = run_query_for_window(
        snuba_query=snuba_query,
        subscription_id=subscription_update["subscription_id"],
        org_id=organization_id,
        project_ids=project_ids,
        window_start=start,
        window_end=end,
        referrer=BASELINE_QUERY_REFERRER,
    )

    if not baseline_value:
        metrics.incr("incidents.alert_rules.skipping_update_comparison_value_invalid")
        return None

    return (evaluation_value / baseline_value) * 100


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
