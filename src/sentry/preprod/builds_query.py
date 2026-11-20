from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sentry.models.organization import Organization
from sentry.preprod.artifact_search import queryset_for_query
from sentry.preprod.models import PreprodArtifactQuerySet
from sentry.preprod.retention import unexpired_artifacts, unexpired_size_analysis

# Display values that constrain the list to non-snapshot builds (size + distribution
# share the same underlying artifacts; only the columns shown differ).
_NON_SNAPSHOT_DISPLAYS = ("size", "distribution")


def filtered_builds_queryset(
    *,
    organization: Organization,
    query: str,
    display: str | None,
    project_ids: Sequence[int],
    start: datetime | None,
    end: datetime | None,
) -> PreprodArtifactQuerySet:
    """Build the PreprodArtifact queryset shared by the builds list and CSV export endpoints.

    Applies the search query, retention, optional date range, project
    scoping, and display-based snapshot filtering. The response of a build whose size
    analysis has expired must not carry it, see `is_size_analysis_expired`. Keeping this in one place ensures
    the CSV export returns exactly the same rows as the on-screen list.

    Callers are responsible for adding their own ``select_related``/``prefetch_related``
    and ordering on top of the returned queryset.

    Raises:
        InvalidSearchQuery: if the query string is invalid.
    """
    queryset = queryset_for_query(query, organization)
    queryset = queryset.filter(unexpired_artifacts())
    # A build is listed for distribution until it expires. That can be after its size
    # analysis has expired, where Build Distribution has the longer retention. Every
    # other display is about the size analysis, or about snapshots, which follow the
    # Size Analysis retention until they have their own.
    if display != "distribution":
        queryset = queryset.filter(unexpired_size_analysis(organization))
    if start:
        queryset = queryset.filter(date_added__gte=start)
    if end:
        queryset = queryset.filter(date_added__lte=end)
    queryset = queryset.filter(project_id__in=project_ids)

    if display in _NON_SNAPSHOT_DISPLAYS:
        queryset = queryset.filter(preprodsnapshotmetrics__isnull=True)
    elif display == "snapshot":
        queryset = queryset.filter(preprodsnapshotmetrics__isnull=False)

    return queryset
