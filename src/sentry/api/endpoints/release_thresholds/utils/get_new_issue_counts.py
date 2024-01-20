from __future__ import annotations

from typing import TYPE_CHECKING, List

from django.db.models import CharField, Count, Q, Value

from sentry.models.group import Group

if TYPE_CHECKING:
    from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold


def get_new_issue_counts(
    organization_id: int, thresholds: List[EnrichedThreshold]
) -> dict[str, int]:
    """
    constructs a query for each threshold, filtering on project
    """
    queryset = None
    for t in thresholds:
        query = Q(
            project__organization__id=organization_id,
            project__id=t["project_id"],
        )
        if t.get("environment", None):
            # If we're filtering on environment, just use the first_release/first_seen from the groupenvironment so we don't need to cross reference tables
            query &= Q(
                groupenvironment__first_release__version=t["release"],
                groupenvironment__first_seen__range=(t["start"], t["end"]),
                groupenvironment__environment__name=t.get("environment", {}).get("name"),
            )
        else:
            query &= Q(
                first_release__version=t["release"],
                first_seen__range=(t["start"], t["end"]),
                groupenvironment__isnull=True,
            )
        qs = (
            Group.objects.filter(query)
            .values("first_release__version")
            .annotate(
                count=Count("*"),
                threshold_id=Value(t["id"], output_field=CharField()),
            )
        )

        if queryset is None:
            queryset = qs
        else:
            queryset = queryset.union(qs)

    return {x["threshold_id"]: x["count"] for x in queryset}
