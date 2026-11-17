import logging
from datetime import datetime

from snuba_sdk import Column, Condition, Limit, Op

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.utils import add_start_end_conditions
from sentry.snuba.dataset import Dataset
from sentry.snuba.entity_subscription import (
    ENTITY_TIME_COLUMNS,
    EntitySubscription,
    get_entity_key_from_query_builder,
    get_entity_subscription_from_snuba_query,
)
from sentry.snuba.models import SnubaQuery
from sentry.utils import snuba_rpc

logger = logging.getLogger(__name__)


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
