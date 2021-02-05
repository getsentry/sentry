from rest_framework.response import Response

from sentry.api.bases import (
    SentryAppInstallationExternalIssueBaseEndpoint as ExternalIssueBaseEndpoint,
)
from sentry.mediators import external_issues
from sentry.models import PlatformExternalIssue


class SentryAppInstallationExternalIssueDetailsEndpoint(ExternalIssueBaseEndpoint):
    def delete(self, request, installation, platform_external_issue):
        try:
            platform_external_issue = PlatformExternalIssue.objects.get(
                id=platform_external_issue,
            )
        except PlatformExternalIssue.DoesNotExist:
            return Response(status=404)

        external_issues.Destroyer.run(external_issue=platform_external_issue)

        return Response(status=204)
