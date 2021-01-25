from rest_framework.response import Response

from sentry.api.bases.group import GroupEndpoint
from sentry.mediators import external_issues
from sentry.models import PlatformExternalIssue


class GroupExternalIssueDetailsEndpoint(GroupEndpoint):
    def delete(self, request, external_issue_id, group):
        try:
            external_issue = PlatformExternalIssue.objects.get(
                id=external_issue_id, group_id=group.id
            )
        except PlatformExternalIssue.DoesNotExist:
            return Response(status=404)

        external_issues.Destroyer.run(external_issue=external_issue)

        return Response(status=204)
