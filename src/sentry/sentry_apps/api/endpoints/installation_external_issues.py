from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.sentry_apps.api.bases.sentryapps import (
    SentryAppInstallationExternalIssueBaseEndpoint as ExternalIssueBaseEndpoint,
)
from sentry.sentry_apps.api.parsers.sentry_app import URLField
from sentry.sentry_apps.api.serializers.platform_external_issue import (
    PlatformExternalIssueSerializer as ResponsePlatformExternalIssueSerializer,
)
from sentry.sentry_apps.services.region import sentry_app_region_service


class PlatformExternalIssueSerializer(serializers.Serializer):
    webUrl = URLField()
    project = serializers.CharField()
    identifier = serializers.CharField()


@control_silo_endpoint
class SentryAppInstallationExternalIssuesEndpoint(ExternalIssueBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.UNKNOWN,
    }

    def post(self, request: Request, installation) -> Response:
        data = request.data

        serializer = PlatformExternalIssueSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            group_id = int(data.pop("issueId"))
        except Exception:
            return Response({"detail": "issueId is required, and must be an integer"}, status=400)

        result = sentry_app_region_service.create_external_issue(
            organization_id=installation.organization_id,
            installation=installation,
            group_id=group_id,
            web_url=data["webUrl"],
            project=data["project"],
            identifier=data["identifier"],
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        if not result.external_issue:
            return Response({"detail": "Failed to create external issue"}, status=500)

        return Response(
            serialize(
                objects=result.external_issue, serializer=ResponsePlatformExternalIssueSerializer()
            )
        )
