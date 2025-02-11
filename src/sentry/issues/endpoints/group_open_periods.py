from __future__ import annotations

from typing import TYPE_CHECKING, Any

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams
from sentry.models.group import get_open_periods_for_group

if TYPE_CHECKING:
    from sentry.models.group import Group


@region_silo_endpoint
class GroupOpenPeriodsEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    def get(self, request: Request, group: Group) -> Response:
        """
        Return a list of open periods for an issue
        """
        try:
            start, end = get_date_range_from_params(request.GET, optional=True)
        except InvalidParams:
            raise ParseError(detail="Invalid date range")

        def data_fn(offset: int, limit: int) -> Any:
            return get_open_periods_for_group(group, start, end, offset, limit)

        return self.paginate(
            request=request,
            on_results=lambda results: [result.to_dict() for result in results],
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
