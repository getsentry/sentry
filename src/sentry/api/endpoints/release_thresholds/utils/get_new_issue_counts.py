from __future__ import annotations

from typing import TYPE_CHECKING, Any, List

from django.db.models import CharField, Count, Q, QuerySet, Value

from sentry.models.group import Group

if TYPE_CHECKING:
    from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold


def get_new_issue_counts(
    organization_id: int, thresholds: List[EnrichedThreshold]
) -> dict[str, int]:
    """
    constructs a query for each threshold, filtering on project
    """
    queryset: QuerySet | None = None
    for t in thresholds:
        env: dict[str, Any] = t.get("environment") or {}
        query = Q(
            project__organization__id=organization_id,
            project__id=t["project_id"],
            groupenvironment__first_release__version=t["release"],
            groupenvironment__first_seen__range=(t["start"], t["end"]),
            groupenvironment__environment__name=env.get("name", ""),
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

    return {x["threshold_id"]: x["count"] for x in queryset} if queryset else {}
