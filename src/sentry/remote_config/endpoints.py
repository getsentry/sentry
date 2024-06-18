import hashlib

from django.contrib.auth.models import AnonymousUser
from rest_framework import serializers
from rest_framework.authentication import BasicAuthentication
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.permissions import RelayPermission
from sentry.models.project import Project
from sentry.remote_config.storage import make_api_backend, make_configuration_backend
from sentry.silo.base import SiloMode
from sentry.utils import json, metrics


class OptionsValidator(Serializer):
    sample_rate = serializers.FloatField(max_value=1.0, min_value=0, required=True)
    traces_sample_rate = serializers.FloatField(max_value=1.0, min_value=0, required=True)


class FeatureValidator(Serializer):
    key = serializers.CharField(required=True)
    value = serializers.JSONField(required=True, allow_null=True)


class ConfigurationValidator(Serializer):
    id = serializers.UUIDField(read_only=True)
    features: serializers.ListSerializer = serializers.ListSerializer(
        child=FeatureValidator(), required=True
    )
    options = OptionsValidator(required=True)


class ConfigurationContainerValidator(Serializer):
    data = ConfigurationValidator(required=True)  # type: ignore[assignment]


@region_silo_endpoint
class ProjectConfigurationEndpoint(ProjectEndpoint):
    owner = ApiOwner.REMOTE_CONFIG
    permission_classes = (ProjectEventPermission,)
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project: Project) -> Response:
        """Get remote configuration from project options."""
        if not features.has(
            "organizations:remote-config", project.organization, actor=request.user
        ):
            return Response("Disabled", status=404)

        remote_config, source = make_api_backend(project).get()
        if remote_config is None:
            return Response("Not found.", status=404)

        return Response(
            {"data": remote_config},
            status=200,
            headers={"X-Sentry-Data-Source": source},
        )

    def post(self, request: Request, project: Project) -> Response:
        """Set remote configuration in project options."""
        if not features.has(
            "organizations:remote-config", project.organization, actor=request.user
        ):
            return Response("Disabled", status=404)

        validator = ConfigurationContainerValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data["data"]

        make_api_backend(project).set(result)
        metrics.incr("remote_config.configuration.write")
        return Response({"data": result}, status=201)

    def delete(self, request: Request, project: Project) -> Response:
        """Delete remote configuration from project options."""
        if not features.has(
            "organizations:remote-config", project.organization, actor=request.user
        ):
            return Response("Disabled", status=404)

        make_api_backend(project).pop()
        metrics.incr("remote_config.configuration.delete")
        return Response("", status=204)


@AuthenticationSiloLimit(SiloMode.REGION)
class RelayAuthentication(BasicAuthentication):
    """Same as default Relay authentication except without body signing."""

    def authenticate(self, request: Request):
        return (AnonymousUser(), None)


class RemoteConfigRelayPermission(RelayPermission):
    def has_permission(self, request: Request, view: object) -> bool:
        # Relay has permission to do everything! Except the only thing we expose is a simple
        # read endpoint full of public data...
        return True


@region_silo_endpoint
class ProjectConfigurationProxyEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.REMOTE_CONFIG
    authentication_classes = (RelayAuthentication,)
    permission_classes = (RemoteConfigRelayPermission,)
    enforce_rate_limit = False

    def get(self, request: Request, project_id: int) -> Response:
        metrics.incr("remote_config.configuration.requested")

        project = Project.objects.select_related("organization").get(pk=project_id)
        if not features.has("organizations:remote-config", project.organization, actor=None):
            metrics.incr("remote_config.configuration.flag_disabled")
            return Response("Disabled", status=404)

        result, source = make_configuration_backend(project).get()
        if result is None:
            metrics.incr("remote_config.configuration.not_found")
            return Response("Not found", status=404)

        result_str = json.dumps(result)
        metrics.incr("remote_config.configuration.returned")
        metrics.distribution("remote_config.configuration.size", value=len(result_str))

        # Emulating cache headers just because.
        return Response(
            result,
            status=200,
            headers={
                "Cache-Control": "public, max-age=3600",
                "ETag": hashlib.sha1(result_str.encode()).hexdigest(),
                "X-Sentry-Data-Source": source,
            },
        )
