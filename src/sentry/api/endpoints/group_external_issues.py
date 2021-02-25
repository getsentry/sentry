import logging

from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import PlatformExternalIssue

logger = logging.getLogger("sentry.group_external_issues.api")


class GroupExternalIssuesEndpoint(GroupEndpoint):
    def get(self, request, group):

        external_issues = PlatformExternalIssue.objects.filter(group_id=group.id)

        logger.info(
            "group_external_issue.get",
            extra={
                "user": request.user,
            },
        )
        return self.paginate(
            request=request,
            queryset=external_issues,
            order_by="id",
            on_results=lambda x: serialize(x, request.user),
        )
