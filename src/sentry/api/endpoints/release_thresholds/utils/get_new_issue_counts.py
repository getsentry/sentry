from __future__ import annotations

from datetime import datetime
from typing import List

from django.db.models import Count, Q

from sentry.models.group import Group


def get_new_issue_counts(
    end: datetime,
    project_id_list: List[int],
    organization_id: int,
    release_value_list: List[str],
    start: datetime,
    environments_list: List[str] | None = None,
):
    issue_group_query = Q(
        project__organization__id=organization_id,
        project__id__in=project_id_list,
        first_release__version__in=release_value_list,
        first_seen__range=(start, end),  # NOTE: start/end for the entire group of thresholds
    )
    if environments_list:
        issue_group_query &= Q(
            groupenvironment__environment__name__in=environments_list,
        )

    qs = (
        Group.objects.filter(issue_group_query)
        .values("project__id", "first_release__version", "groupenvironment__environment__name")
        .annotate(count=Count("first_release__version"))
    )
    return qs
