import logging
from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime

from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.occurrences_rpc import OccurrenceCategory, Occurrences

logger = logging.getLogger(__name__)


def count_occurrences(
    organization: Organization,
    projects: Sequence[Project],
    start: datetime,
    end: datetime,
    referrer: str,
    group_id: int | None = None,
    environments: Sequence[Environment] | None = None,
    occurrence_category: OccurrenceCategory | None = None,
) -> int:
    """
    Count the number of occurrences in EAP matching the given filters.

    Returns:
        The count of matching occurrences, or 0 if the query fails
    """
    query_string = f"group_id:{group_id}" if group_id is not None else ""

    snuba_params = SnubaParams(
        start=start,
        end=end,
        organization=organization,
        projects=projects,
        environments=environments if environments else [],
    )

    try:
        result = Occurrences.run_table_query(
            params=snuba_params,
            query_string=query_string,
            selected_columns=["count()"],
            orderby=None,
            offset=0,
            limit=1,
            referrer=referrer,
            config=SearchResolverConfig(),
            occurrence_category=occurrence_category,
        )

        if result["data"]:
            return int(result["data"][0].get("count()", 0))
        return 0
    except Exception:
        logger.exception(
            "Fetching occurrence count from EAP failed",
            extra={
                "organization_id": organization.id,
                "project_ids": [p.id for p in projects],
                "group_id": group_id,
                "referrer": referrer,
            },
        )
        return 0


def count_occurrences_grouped_by_trace_ids(
    snuba_params: SnubaParams,
    trace_ids: Sequence[str],
    referrer: str,
    occurrence_category: OccurrenceCategory | None = None,
) -> dict[str, int]:
    """
    Count occurrences grouped by trace IDs.

    Returns:
        A mapping of trace ID to occurrence count, or an empty dict if the query fails.
    """
    if not trace_ids:
        return {}

    query_string = f"trace:[{','.join(trace_ids)}]"

    try:
        result = Occurrences.run_table_query(
            params=snuba_params,
            query_string=query_string,
            selected_columns=["trace", "count()"],
            orderby=None,
            offset=0,
            limit=len(trace_ids),
            referrer=referrer,
            config=SearchResolverConfig(),
            occurrence_category=occurrence_category,
        )

        return {
            str(row["trace"]): int(row["count()"])
            for row in result.get("data", [])
            if row.get("trace") is not None
        }
    except Exception:
        logger.exception(
            "Fetching grouped trace occurrence counts from EAP failed",
            extra={
                "organization_id": (
                    snuba_params.organization.id if snuba_params.organization else None
                ),
                "project_ids": [p.id for p in snuba_params.projects],
                "trace_ids": list(trace_ids),
                "start": snuba_params.start.isoformat() if snuba_params.start else None,
                "end": snuba_params.end.isoformat() if snuba_params.end else None,
                "referrer": referrer,
            },
        )
        return {}


def get_group_ids_for_trace_id(
    snuba_params: SnubaParams,
    trace_id: str,
    referrer: str,
    limit: int,
    occurrence_category: OccurrenceCategory | None = None,
    orderby: list[str] | None = None,
    offset: int = 0,
) -> set[int]:
    """
    Get the group IDs for a given trace ID.

    Returns:
        A set of group IDs, or an empty set if the query fails.
    """
    if not trace_id:
        return set()

    try:
        result = Occurrences.run_table_query(
            params=snuba_params,
            query_string=f"trace:{trace_id}",
            selected_columns=["group_id", "count()"],
            orderby=orderby,
            offset=offset,
            limit=limit,
            referrer=referrer,
            config=SearchResolverConfig(),
            occurrence_category=occurrence_category,
        )

        group_ids: set[int] = set()
        for row in result.get("data", []):
            group_id = row.get("group_id")
            if group_id is not None:
                group_ids.add(int(group_id))
        return group_ids
    except Exception:
        logger.exception(
            "Fetching group ids for trace from EAP failed",
            extra={
                "trace_id": trace_id,
                "organization_id": (
                    snuba_params.organization.id if snuba_params.organization is not None else None
                ),
                "project_ids": [project.id for project in snuba_params.projects],
                "start": snuba_params.start.isoformat() if snuba_params.start else None,
                "end": snuba_params.end.isoformat() if snuba_params.end else None,
                "referrer": referrer,
            },
        )
        return set()


def get_group_to_trace_ids_map(
    snuba_params: SnubaParams,
    trace_ids: Sequence[str],
    referrer: str,
    limit: int,
    occurrence_category: OccurrenceCategory | None = None,
    orderby: list[str] | None = None,
    offset: int = 0,
) -> dict[int, set[str]]:
    """
    Get a map of group IDs to trace IDs.

    Returns:
        A mapping of group ID to set of trace IDs, or an empty dict if the query fails.
    """
    if not trace_ids:
        return {}

    query_string = f"trace:[{','.join(trace_ids)}]"

    try:
        result = Occurrences.run_table_query(
            params=snuba_params,
            query_string=query_string,
            selected_columns=["group_id", "trace", "timestamp"],
            orderby=orderby,
            offset=offset,
            limit=limit,
            referrer=referrer,
            config=SearchResolverConfig(),
            occurrence_category=occurrence_category,
        )

        grouped: dict[int, set[str]] = defaultdict(set)
        for row in result.get("data", []):
            group_id = row.get("group_id")
            trace_id = row.get("trace")
            if group_id is not None and trace_id is not None:
                grouped[int(group_id)].add(str(trace_id))
        return dict(grouped)
    except Exception:
        logger.exception(
            "Fetching grouped trace ids by group from EAP failed",
            extra={
                "organization_id": (
                    snuba_params.organization.id if snuba_params.organization is not None else None
                ),
                "project_ids": [project.id for project in snuba_params.projects],
                "trace_ids": list(trace_ids),
                "start": snuba_params.start.isoformat() if snuba_params.start else None,
                "end": snuba_params.end.isoformat() if snuba_params.end else None,
                "referrer": referrer,
            },
        )
        return {}
