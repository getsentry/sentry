from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.net.socket import is_valid_url
from sentry.sentry_apps.services.legacy_webhook.service import split_urls

_url_validator = URLValidator(schemes=["http", "https"])


class LegacyWebhookSerializer(serializers.Serializer[None]):
    urls = serializers.ListField(child=serializers.CharField(max_length=2048), required=False)
    enabled = serializers.BooleanField(required=False)

    def validate_urls(self, value: list[str]) -> list[str]:
        for url in value:
            try:
                _url_validator(url)
            except DjangoValidationError:
                raise serializers.ValidationError("Invalid URL format.")
            if not is_valid_url(url):
                raise serializers.ValidationError("Not a valid URL.")
        return value


@cell_silo_endpoint
class ProjectLegacyWebhooksEndpoint(ProjectEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project) -> Response:
        urls_raw = ProjectOption.objects.get_value(project, "webhooks:urls", default="")
        urls = split_urls(urls_raw)
        enabled = ProjectOption.objects.get_value(project, "webhooks:enabled", default=False)
        return Response({"urls": urls, "enabled": enabled})

    def post(self, request: Request, project: Project) -> Response:
        serializer = LegacyWebhookSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        if "urls" in serializer.validated_data:
            urls = serializer.validated_data["urls"]
            ProjectOption.objects.set_value(project, "webhooks:urls", "\n".join(urls))

        if "enabled" in serializer.validated_data:
            enabled = serializer.validated_data["enabled"]
            ProjectOption.objects.set_value(project, "webhooks:enabled", enabled)

        urls_raw = ProjectOption.objects.get_value(project, "webhooks:urls", default="")
        return Response(
            {
                "urls": split_urls(urls_raw),
                "enabled": ProjectOption.objects.get_value(
                    project, "webhooks:enabled", default=False
                ),
            },
            status=200,
        )

    def delete(self, request: Request, project: Project) -> Response:
        ProjectOption.objects.unset_value(project, "webhooks:urls")
        ProjectOption.objects.unset_value(project, "webhooks:enabled")
        return Response(status=204)
