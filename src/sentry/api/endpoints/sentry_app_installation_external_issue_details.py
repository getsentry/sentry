from rest_framework.response import Response

from sentry.api.bases import (
    SentryAppInstallationExternalIssueBaseEndpoint as ExternalIssueBaseEndpoint,
)
from sentry.mediators import external_issues
from sentry.models import PlatformExternalIssue


class SentryAppInstallationExternalIssueDetailsEndpoint(ExternalIssueBaseEndpoint):
    def delete(self, request, external_issue_id):
        try:
            external_issue = PlatformExternalIssue.objects.get(
                id=external_issue_id,
            )
        except PlatformExternalIssue.DoesNotExist:
            return Response(status=404)

        external_issues.Destroyer.run(external_issue=external_issue)

        return Response(status=204)
