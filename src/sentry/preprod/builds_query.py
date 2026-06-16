from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sentry.models.organization import Organization
from sentry.preprod.artifact_search import queryset_for_query
from sentry.preprod.models import PreprodArtifactQuerySet
from sentry.preprod.quotas import (
    get_build_distribution_retention_cutoff,
    get_size_retention_cutoff,
)

# Display values that constrain the list to non-snapshot builds (size + distribution
# share the same underlying artifacts; only the columns shown differ).
_NON_SNAPSHOT_DISPLAYS = ("size", "distribution")


def _retention_cutoff_for_display(organization: Organization, display: str | None) -> datetime:
    """Pick the retention cutoff for a builds view: the distribution view reads
    installable-build retention, while size and snapshot read (shorter) size-analysis
    retention. A missing or unrecognized display follows the frontend default of "size".
    """
    match display:
        case "distribution":
            return get_build_distribution_retention_cutoff(organization)
        case "size" | "snapshot":
            return get_size_retention_cutoff(organization)
        case _:
            return get_size_retention_cutoff(organization)


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

    Applies the search query, the display-appropriate retention cutoff, optional
    date range, project scoping, and display-based snapshot filtering. Keeping this
    in one place ensures the CSV export returns exactly the same rows as the
    on-screen list.

    Callers are responsible for adding their own ``select_related``/``prefetch_related``
    and ordering on top of the returned queryset.

    Raises:
        InvalidSearchQuery: if the query string is invalid.
    """
    queryset = queryset_for_query(query, organization)
    queryset = queryset.filter(date_added__gte=_retention_cutoff_for_display(organization, display))
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
