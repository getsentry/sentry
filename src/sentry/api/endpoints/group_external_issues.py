import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import PlatformExternalIssue

logger = logging.getLogger("sentry.api")


@region_silo_endpoint
class GroupExternalIssuesEndpoint(GroupEndpoint):
    def get(self, request: Request, group) -> Response:

        external_issues = PlatformExternalIssue.objects.filter(group_id=group.id)

        logger.info(
            "group_external_issue.get",
            extra={
                "user": request.user.username,
                "is_sentry_app_user": request.user.is_sentry_app,
            },
        )
        return self.paginate(
            request=request,
            queryset=external_issues,
            order_by="id",
            on_results=lambda x: serialize(x, request.user),
        )
