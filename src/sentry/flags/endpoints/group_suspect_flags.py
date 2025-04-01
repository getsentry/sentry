from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.utils import get_date_range_from_params
from sentry.issues.suspect_flags import get_suspect_flag_scores
from sentry.models.group import Group


@region_silo_endpoint
class GroupSuspectFlagsEndpoint(GroupEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, group: Group) -> Response:
        start, end = get_date_range_from_params(request.GET)
        if start is None or end is None:
            raise ParseError(detail="Invalid date range")

        scores = get_suspect_flag_scores(
            organization_id=group.project.organization_id,
            project_id=group.project_id,
            start=start,
            end=end,
            group_id=group.id,
        )

        return Response({"data": scores})
