from __future__ import annotations

from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any

from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.incidents.utils.metric_issue_poc import OpenPeriod
from sentry.issues.grouptype import MetricIssuePOC
from sentry.models.activity import Activity
from sentry.types.activity import ActivityType

if TYPE_CHECKING:
    from sentry.models.group import Group


def get_open_periods_for_group(
    group: Group,
    offset: int | None = None,
    limit: int | None = None,
) -> list[OpenPeriod]:
    if group.type != MetricIssuePOC.type_id:
        return []

    activities = Activity.objects.filter(
        group=group,
        type__in=[ActivityType.SET_UNRESOLVED.value, ActivityType.SET_RESOLVED.value],
        datetime__gte=timezone.now() - timedelta(days=90),
    ).order_by("datetime")

    open_periods = []
    start: datetime | None = group.first_seen

    for activity in activities:
        if activity.type == ActivityType.SET_RESOLVED.value and start:
            open_periods.append(
                OpenPeriod(
                    start=start,
                    end=activity.datetime,
                    duration=activity.datetime - start,
                    is_open=False,
                )
            )
            start = None
        elif activity.type == ActivityType.SET_UNRESOLVED.value and not start:
            start = activity.datetime

    if start:
        open_periods.append(
            OpenPeriod(
                start=start,
                end=None,
                duration=None,
                is_open=True,
            )
        )

    open_periods = open_periods[::-1]
    if offset and limit:
        open_periods = open_periods[offset : offset + limit]
    elif limit:
        open_periods = open_periods[:limit]

    return open_periods


@region_silo_endpoint
class GroupOpenPeriodsEndpoint(GroupEndpoint, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    def get(self, request: Request, group: Group) -> Response:
        """
        Return a list of open periods for an issue
        """

        def data_fn(offset: int, limit: int) -> Any:
            return get_open_periods_for_group(group, offset, limit)

        return self.paginate(
            request=request,
            on_results=lambda results: [result.to_dict() for result in results],
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
