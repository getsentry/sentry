from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_CONFLICT
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationExternalIssueBaseEndpoint
from sentry.sentry_apps.api.serializers.platform_external_issue import (
    PlatformExternalIssueSerializer,
)
from sentry.sentry_apps.external_requests.utils import validate_sentry_app_uri
from sentry.sentry_apps.services.cell import sentry_app_cell_service
from sentry.users.services.user.serial import serialize_generic_user


class SentryAppInstallationExternalIssueActionsSerializer(serializers.Serializer):
    groupId = serializers.CharField(required=True, allow_null=False)
    action = serializers.CharField(required=True, allow_null=False)
    uri = serializers.CharField(
        required=True, allow_null=False, validators=[validate_sentry_app_uri]
    )


class SentryAppIssueLinkOptionsSerializer(serializers.Serializer):
    expectedExternalIssueUrl = serializers.URLField(required=False)


@control_silo_endpoint
class SentryAppInstallationExternalIssueActionsEndpoint(
    SentryAppInstallationExternalIssueBaseEndpoint
):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="expectedExternalIssueUrl",
                location=OpenApiParameter.QUERY,
                type=str,
                description="The exact canonical webUrl of the external issue to link. "
                "Only supported for action=link. An existing matching association is a no-op; "
                "a different association or callback URL returns 409 without replacing the link.",
            ),
        ],
        responses={409: RESPONSE_CONFLICT},
    )
    def post(self, request: Request, installation) -> Response:
        """Submit resolved App fields to its callback.

        For `action=link`, the optional `expectedExternalIssueUrl` query parameter
        requires an exact canonical `webUrl` match. An existing matching link is
        returned with `changed: false` without calling the App; a different link
        returns 409. The callback must also return this URL before a new link is
        saved. Callback effects cannot be rolled back if its response conflicts.
        Omitting the parameter preserves the App's existing replacement behavior.
        """
        data = request.data.copy()

        external_issue_action_serializer = SentryAppInstallationExternalIssueActionsSerializer(
            data=data
        )

        if not external_issue_action_serializer.is_valid():
            return Response(external_issue_action_serializer.errors, status=400)

        options = SentryAppIssueLinkOptionsSerializer(data=request.query_params)
        if not options.is_valid():
            return Response(options.errors, status=400)

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
            expected_external_issue_url=options.validated_data.get("expectedExternalIssueUrl"),
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        if not result.external_issue:
            return Response({"detail": "Failed to create external issue"}, status=500)

        external_issue_data = serialize(
            objects=result.external_issue, serializer=PlatformExternalIssueSerializer()
        )
        if result.changed is not None:
            return Response({**external_issue_data, "changed": result.changed})
        return Response(external_issue_data)
