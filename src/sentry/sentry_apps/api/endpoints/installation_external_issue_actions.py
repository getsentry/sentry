from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import SentryAppParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationExternalIssueBaseEndpoint
from sentry.sentry_apps.api.serializers.platform_external_issue import (
    PlatformExternalIssueSerializer,
    PlatformExternalIssueSerializerResponse,
)
from sentry.sentry_apps.external_requests.utils import validate_sentry_app_uri
from sentry.sentry_apps.services.cell import sentry_app_cell_service
from sentry.sentry_apps.utils.errors import SentryAppPublicErrorBody
from sentry.users.services.user.serial import serialize_generic_user


class SentryAppInstallationExternalIssueActionsSerializer(serializers.Serializer):
    groupId = serializers.CharField(
        required=True, allow_null=False, help_text="The numeric Sentry issue ID."
    )
    action = serializers.CharField(
        required=True, allow_null=False, help_text="The action to perform: `link` or `create`."
    )
    uri = serializers.CharField(
        required=True,
        allow_null=False,
        validators=[validate_sentry_app_uri],
        help_text="The relative callback URI from the app's issue-link form.",
    )


@extend_schema(tags=["Integration"])
@control_silo_endpoint
class SentryAppInstallationExternalIssueActionsEndpoint(
    SentryAppInstallationExternalIssueBaseEndpoint
):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "POST": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="executeSentryAppInstallationExternalIssueAction",
        summary="Create or Link an External Issue Through a Sentry App",
        parameters=[SentryAppParams.INSTALLATION_UUID],
        request=SentryAppInstallationExternalIssueActionsSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "PlatformExternalIssueResponse", PlatformExternalIssueSerializerResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self, request: Request, installation
    ) -> (
        Response[PlatformExternalIssueSerializerResponse]
        | Response[DetailResponse]
        | Response[ValidationErrorResponse]
        | Response[SentryAppPublicErrorBody]
    ):
        """
        Invoke the installed app's issue-link callback and store the returned association.
        Submit the app-specific form fields alongside `groupId`, `action`, and `uri`.
        """
        data = request.data.copy()

        external_issue_action_serializer = SentryAppInstallationExternalIssueActionsSerializer(
            data=data
        )

        if not external_issue_action_serializer.is_valid():
            return Response(as_validation_errors(external_issue_action_serializer), status=400)

        group_id = data.pop("groupId")
        action = data.pop("action")
        uri = data.pop("uri")

        rpc_user = serialize_generic_user(request.user)
        if rpc_user is None:
            return Response({"detail": "Authentication credentials were not provided."}, status=401)

        result = sentry_app_cell_service.create_issue_link(
            organization_id=installation.organization_id,
            installation=installation,
            group_id=int(group_id),
            action=action,
            fields=data,
            uri=uri,
            user=rpc_user,
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        if not result.external_issue:
            return Response({"detail": "Failed to create external issue"}, status=500)

        body: PlatformExternalIssueSerializerResponse = serialize(
            objects=result.external_issue, serializer=PlatformExternalIssueSerializer()
        )
        return Response(body)
