import logging
from collections.abc import Sequence
from datetime import datetime

from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.occurrences_rpc import Occurrences

logger = logging.getLogger(__name__)


def count_occurrences(
    organization: Organization,
    projects: Sequence[Project],
    start: datetime,
    end: datetime,
    referrer: str,
    group_id: int | None = None,
    environments: Sequence[Environment] | None = None,
) -> int:
    """
    Count the number of occurrences in EAP matching the given filters.

    Args:
        organization: The organization to query
        projects: List of projects to query
        start: Start timestamp
        end: End timestamp
        referrer: Referrer string for the query
        group_id: Optional group ID to filter by
        environments: Optional list of environments to filter by

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
