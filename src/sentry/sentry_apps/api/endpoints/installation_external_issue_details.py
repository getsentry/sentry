from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.sentry_apps.api.bases.sentryapps import (
    SentryAppInstallationExternalIssueBaseEndpoint as ExternalIssueBaseEndpoint,
)
from sentry.sentry_apps.services.region import sentry_app_region_service
from sentry.sentry_apps.utils.errors import SentryAppError


@control_silo_endpoint
class SentryAppInstallationExternalIssueDetailsEndpoint(ExternalIssueBaseEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
    }

    def delete(self, request: Request, installation, external_issue_id) -> Response:
        try:
            external_issue_id = int(external_issue_id)
        except (ValueError, TypeError):
            raise SentryAppError(
                message="Invalid external_issue_id format. Expected numeric value.",
                status_code=400,
            )

        result = sentry_app_region_service.delete_external_issue(
            organization_id=installation.organization_id,
            installation=installation,
            external_issue_id=external_issue_id,
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        return Response(status=204)
