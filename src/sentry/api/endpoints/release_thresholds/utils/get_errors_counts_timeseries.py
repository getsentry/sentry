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

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.occurrences_rpc import OccurrenceCategory, Occurrences
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba

logger = logging.getLogger(__name__)


def _escape_search_query_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


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
            reasonable_match_comparator=_reasonable_timeseries_match,
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

    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "Organization not found for EAP error counts timeseries query",
            extra={"organization_id": organization_id},
        )
        return []

    projects = list(Project.objects.filter(id__in=project_id_list, organization_id=organization_id))
    if not projects:
        return []

    query_parts: list[str] = []

    escaped_releases = [_escape_search_query_value(value) for value in release_value_list]
    if len(escaped_releases) == 1:
        query_parts.append(f'release:"{escaped_releases[0]}"')
    else:
        release_filter = ", ".join([f'"{release}"' for release in escaped_releases])
        query_parts.append(f"release:[{release_filter}]")

    if environments_list:
        escaped_environments = [_escape_search_query_value(value) for value in environments_list]
        if len(escaped_environments) == 1:
            query_parts.append(f'environment:"{escaped_environments[0]}"')
        else:
            env_filter = ", ".join([f'"{environment}"' for environment in escaped_environments])
            query_parts.append(f"environment:[{env_filter}]")

    query_string = " ".join(query_parts)

    snuba_params = SnubaParams(
        start=start,
        end=end,
        organization=organization,
        projects=projects,
        granularity_secs=60,
    )

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


def _reasonable_timeseries_match(
    snuba_results: list[dict[str, Any]], eap_results: list[dict[str, Any]]
) -> bool:
    snuba_by_key = {
        (row["release"], int(row["project_id"]), row["environment"], row["time"]): int(
            row["count()"]
        )
        for row in snuba_results
    }
    eap_by_key = {
        (row["release"], int(row["project_id"]), row["environment"], row["time"]): int(
            row["count()"]
        )
        for row in eap_results
    }

    if not set(eap_by_key).issubset(set(snuba_by_key)):
        return False

    return all(eap_count <= snuba_by_key[key] for key, eap_count in eap_by_key.items())
