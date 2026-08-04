from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import SentryAppParams
from sentry.sentry_apps.api.bases.sentryapps import (
    SentryAppInstallationExternalIssueBaseEndpoint as ExternalIssueBaseEndpoint,
)
from sentry.sentry_apps.services.cell import sentry_app_cell_service
from sentry.sentry_apps.utils.errors import SentryAppError
from sentry.users.services.user.serial import serialize_generic_user

_EXTERNAL_ISSUE_ID_PARAM = OpenApiParameter(
    name="external_issue_id",
    location="path",
    required=True,
    type=int,
    description="The ID of the external issue link to remove.",
)


@extend_schema(tags=["Integration"])
@control_silo_endpoint
class SentryAppInstallationExternalIssueDetailsEndpoint(ExternalIssueBaseEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="deleteSentryAppInstallationExternalIssue",
        summary="Delete an External Issue",
        parameters=[SentryAppParams.INSTALLATION_UUID, _EXTERNAL_ISSUE_ID_PARAM],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, installation, external_issue_id) -> Response:
        """
        Remove the link between a Sentry issue and an external resource created through a
        custom integration (Sentry App) installation.
        """
        try:
            external_issue_id = int(external_issue_id)
        except (ValueError, TypeError):
            raise SentryAppError(
                message="Invalid external_issue_id format. Expected numeric value.",
                status_code=400,
            )

        rpc_user = serialize_generic_user(request.user)
        if rpc_user is None:
            return Response({"detail": "Authentication credentials were not provided."}, status=401)

        result = sentry_app_cell_service.delete_external_issue(
            organization_id=installation.organization_id,
            installation=installation,
            external_issue_id=external_issue_id,
            user=rpc_user,
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        return Response(status=204)
