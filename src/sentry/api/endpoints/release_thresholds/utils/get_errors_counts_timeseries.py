from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from snuba_sdk import Request as SnubaRequest
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, OrderBy
from snuba_sdk.query import Query

from sentry.search.eap.occurrences.query_utils import (
    build_escaped_term_filter,
    build_snuba_params_from_ids,
    keyed_counts_subset_match,
)
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.dataset import Dataset
from sentry.snuba.occurrences_rpc import OccurrenceCategory, Occurrences
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba

logger = logging.getLogger(__name__)


def get_errors_counts_timeseries_by_project_and_release(
    end: datetime,
    organization_id: int,
    project_id_list: list[int],
    release_value_list: list[str],
    start: datetime,
    environments_list: list[str] | None = None,
) -> list[dict[str, Any]]:
    snuba_results = _get_errors_counts_timeseries_snuba(
        end=end,
        organization_id=organization_id,
        project_id_list=project_id_list,
        release_value_list=release_value_list,
        start=start,
        environments_list=environments_list,
    )
    results = snuba_results

    if EAPOccurrencesComparator.should_check_experiment(
        "release_thresholds.get_errors_counts_timeseries"
    ):
        eap_results = _get_errors_counts_timeseries_eap(
            end=end,
            organization_id=organization_id,
            project_id_list=project_id_list,
            release_value_list=release_value_list,
            start=start,
            environments_list=environments_list,
        )
        results = EAPOccurrencesComparator.check_and_choose(
            snuba_results,
            eap_results,
            "release_thresholds.get_errors_counts_timeseries",
            is_experimental_data_a_null_result=len(eap_results) == 0,
            reasonable_match_comparator=lambda snuba_rows, eap_rows: keyed_counts_subset_match(
                snuba_rows,
                eap_rows,
                key_fn=lambda row: (
                    row["release"],
                    int(row["project_id"]),
                    row["environment"],
                    row["time"],
                ),
            ),
            debug_context={
                "organization_id": organization_id,
                "project_ids": project_id_list,
                "releases": release_value_list,
                "environments": environments_list,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "snuba_result_count": len(snuba_results),
                "eap_result_count": len(eap_results),
            },
        )

    return results


def _get_errors_counts_timeseries_snuba(
    end: datetime,
    organization_id: int,
    project_id_list: list[int],
    release_value_list: list[str],
    start: datetime,
    environments_list: list[str] | None = None,
) -> list[dict[str, Any]]:
    additional_conditions = []
    if environments_list:
        additional_conditions.append(Condition(Column("environment"), Op.IN, environments_list))
    query = Query(
        match=Entity("events"),  # synonymous w/ discover dataset
        select=[Function("count", [])],
        groupby=[
            Column("release"),
            Column("project_id"),
            Column("environment"),
            Column("time"),  # groupby 'time' gives us a timeseries
        ],
        orderby=[
            OrderBy(Column("time"), Direction.DESC),
        ],
        granularity=Granularity(60),
        where=[
            Condition(Column("type"), Op.EQ, "error"),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("project_id"), Op.IN, project_id_list),
            Condition(Column("release"), Op.IN, release_value_list),
            *additional_conditions,
        ],
    )
    request = SnubaRequest(
        dataset=Dataset.Events.value,
        app_id="default",
        query=query,
        tenant_ids={"organization_id": organization_id},
    )
    data = snuba.raw_snql_query(
        request=request, referrer=Referrer.SNUBA_SESSIONS_CHECK_RELEASES_HAVE_HEALTH_DATA
    )["data"]

    return data


def _get_errors_counts_timeseries_eap(
    end: datetime,
    organization_id: int,
    project_id_list: list[int],
    release_value_list: list[str],
    start: datetime,
    environments_list: list[str] | None = None,
) -> list[dict[str, Any]]:
    if not release_value_list:
        return []

    snuba_params = build_snuba_params_from_ids(
        organization_id=organization_id,
        project_ids=project_id_list,
        start=start,
        end=end,
        granularity_secs=60,
    )
    if snuba_params is None:
        logger.warning(
            "Organization or projects not found for EAP error counts timeseries query",
            extra={"organization_id": organization_id, "project_ids": project_id_list},
        )
        return []

    query_parts: list[str] = []

    release_filter = build_escaped_term_filter("release", release_value_list)
    if release_filter:
        query_parts.append(release_filter)

    environment_filter = build_escaped_term_filter("environment", environments_list or [])
    if environment_filter:
        query_parts.append(environment_filter)

    query_string = " ".join(query_parts)

    try:
        timeseries_results = Occurrences.run_grouped_timeseries_query(
            params=snuba_params,
            query_string=query_string,
            y_axes=["count()"],
            groupby=["release", "project_id", "environment"],
            referrer=Referrer.SNUBA_SESSIONS_CHECK_RELEASES_HAVE_HEALTH_DATA.value,
            config=SearchResolverConfig(),
            occurrence_category=OccurrenceCategory.ERROR,
        )

        # Transform to match Snuba response format
        transformed: list[dict[str, Any]] = []
        for row in timeseries_results:
            count = row.get("count()", 0)
            if count > 0:
                bucket_dt = datetime.fromtimestamp(row["time"], tz=timezone.utc)
                transformed.append(
                    {
                        "release": row.get("release"),
                        "project_id": int(row["project_id"]),
                        "environment": row.get("environment"),
                        "time": bucket_dt.isoformat(),
                        "count()": int(count),
                    }
                )

        transformed.sort(key=lambda row: row["time"], reverse=True)

        return transformed

    except Exception:
        logger.exception(
            "Fetching error counts timeseries from EAP failed",
            extra={
                "organization_id": organization_id,
                "project_ids": project_id_list,
                "releases": release_value_list,
            },
        )
        return []
