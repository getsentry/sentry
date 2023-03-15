from rest_framework.request import Request
from rest_framework.response import Response

from sentry import deletions
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.models import PlatformExternalIssue


@region_silo_endpoint
class GroupExternalIssueDetailsEndpoint(GroupEndpoint):
    def delete(self, request: Request, external_issue_id, group) -> Response:
        try:
            external_issue = PlatformExternalIssue.objects.get(
                id=external_issue_id, group_id=group.id
            )
        except PlatformExternalIssue.DoesNotExist:
            return Response(status=404)

        deletions.exec_sync(external_issue)

        return Response(status=204)
