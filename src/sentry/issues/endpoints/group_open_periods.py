from __future__ import annotations

from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.models.group import Group
from sentry.models.groupopenperiod import OpenPeriod, get_open_periods_for_group


@region_silo_endpoint
class GroupOpenPeriodsEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    def get(self, request: Request, group: Group) -> Response:
        def data_fn(offset: int, limit: int) -> list[OpenPeriod] | list[Any]:
            return get_open_periods_for_group(group=group, offset=offset, limit=limit)

        return self.paginate(
            request=request,
            on_results=lambda results: [result.to_dict() for result in results],
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
