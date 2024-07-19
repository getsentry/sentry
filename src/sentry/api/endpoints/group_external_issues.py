from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models.platformexternalissue import PlatformExternalIssue


@region_silo_endpoint
class GroupExternalIssuesEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, group) -> Response:
        external_issues = PlatformExternalIssue.objects.filter(group_id=group.id)

        return self.paginate(
            request=request,
            queryset=external_issues,
            order_by="id",
            on_results=lambda x: serialize(x, request.user),
        )
