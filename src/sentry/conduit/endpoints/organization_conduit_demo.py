import sentry_sdk
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.conduit.auth import get_conduit_credentials
from sentry.models.organization import Organization


class ConduitCredentialsSerializer(serializers.Serializer):
    token = serializers.CharField()
    channel_id = serializers.UUIDField()
    url = serializers.URLField()


class ConduitCredentialsResponseSerializer(serializers.Serializer):
    conduit = ConduitCredentialsSerializer()


@region_silo_endpoint
class OrganizationConduitDemoEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.INFRA_ENG

    def post(self, request: Request, organization: Organization) -> Response:
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
        serializer = ConduitCredentialsResponseSerializer(
            {
                "conduit": conduit_credentials._asdict(),
            }
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)
