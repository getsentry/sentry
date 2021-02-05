from rest_framework.response import Response

from sentry.api.bases import (
    SentryAppInstallationExternalIssueBaseEndpoint as ExternalIssueBaseEndpoint,
)
from sentry.mediators import external_issues
from sentry.models import PlatformExternalIssue


class SentryAppInstallationExternalIssueDetailsEndpoint(ExternalIssueBaseEndpoint):
    def delete(self, request, installation, external_issue_id):
        try:
            platform_external_issue = PlatformExternalIssue.objects.get(
                id=external_issue_id,
                project__organization=installation.organization,
                service_type=installation.sentry_app.slug,
            )
        except PlatformExternalIssue.DoesNotExist:
            return Response(status=404)

        external_issues.Destroyer.run(external_issue=platform_external_issue)

        return Response(status=204)
