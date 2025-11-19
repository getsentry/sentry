import sentry_sdk
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.conduit.auth import get_conduit_credentials
from sentry.conduit.tasks import stream_demo_data
from sentry.models.organization import Organization


class ConduitCredentialsSerializer(serializers.Serializer):
    token = serializers.CharField()
    channel_id = serializers.UUIDField()
    url = serializers.URLField()


class ConduitCredentialsResponseSerializer(serializers.Serializer):
    conduit = ConduitCredentialsSerializer()


class OrganizationConduitDemoPermission(OrganizationPermission):
    """
    Permission for the conduit demo endpoint.
    We want members to be able to generate temporary credentials for the demo.
    This is a demo-only feature and doesn't modify organization state.
    """

    scope_map = {
        "POST": ["org:read", "org:write", "org:admin"],
    }


@region_silo_endpoint
class OrganizationConduitDemoEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationConduitDemoPermission,)
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.INFRA_ENG

    def post(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:conduit-demo", organization, actor=request.user):
            return Response(status=404)
        try:
            conduit_credentials = get_conduit_credentials(
                organization.id,
            )
        except ValueError as e:
            sentry_sdk.capture_exception(e, level="warning")
            return Response(
                {"error": "Conduit is not configured properly"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        # Kick off a task to stream data to Conduit
        stream_demo_data.delay(organization.id, conduit_credentials.channel_id)
        serializer = ConduitCredentialsResponseSerializer(
            {
                "conduit": conduit_credentials._asdict(),
            }
        )
        # Respond back to the user with the credentials needed to connect to Conduit
        return Response(serializer.data, status=status.HTTP_201_CREATED)
