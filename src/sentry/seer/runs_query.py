from __future__ import annotations

from collections.abc import Collection
from datetime import datetime

from django.db.models import Q, QuerySet

from sentry.models.organization import Organization
from sentry.seer.models.run import SeerRun
from sentry.seer.runs_search import queryset_for_query


def filtered_runs_queryset(
    *,
    organization: Organization,
    query: str,
    user_id: int | None,
    accessible_project_ids: Collection[int],
    start: datetime | None,
    end: datetime | None,
) -> QuerySet[SeerRun]:
    """Build the ``SeerRun`` queryset for the runs list endpoint.

    Applies the structured search query (including the ``is:mine`` owner filter,
    scoped to ``user_id``), organization scope, project-access scoping, and an
    optional ``last_triggered_at`` date range. Callers are responsible for adding
    their own ``select_related`` and ordering on top of the returned queryset.

    Runs tied to a project the caller cannot access are excluded so we don't leak
    project/group identifiers; runs with no associated project (including those
    with no ``SeerAgentRun`` row) are always kept.

    Raises:
        InvalidSearchQuery: if the query string is invalid.
    """
    queryset = queryset_for_query(query, organization, user_id)

    queryset = queryset.filter(
        Q(agent__project_id__isnull=True) | Q(agent__project_id__in=accessible_project_ids)
    )

    if start:
        queryset = queryset.filter(last_triggered_at__gte=start)
    if end:
        queryset = queryset.filter(last_triggered_at__lte=end)

    return queryset
