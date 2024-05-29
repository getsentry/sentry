from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.models.project import Project
from sentry.remote_config.storage import make_storage


class OptionValidator(Serializer):
    sample_rate = serializers.FloatField(max_value=1.0, min_value=0, required=True)
    traces_sample_rate = serializers.FloatField(max_value=1.0, min_value=0, required=True)


class FeatureValidator(Serializer):
    key = serializers.CharField(required=True)
    value = serializers.JSONField(required=True, allow_null=True)


class ConfigurationValidator(Serializer):
    id = serializers.UUIDField(read_only=True)
    features = serializers.ListSerializer(child=FeatureValidator(), required=True)  # type: ignore[assignment]
    options = OptionValidator(required=True)  # type: ignore[assignment]


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
            return Response(status=404)

        remote_config = make_storage(project).get()
        if remote_config is None:
            return Response("Not found.", status=404)

        return Response({"data": remote_config}, status=200)

    def post(self, request: Request, project: Project) -> Response:
        """Set remote configuration in project options."""
        if not features.has(
            "organizations:remote-config", project.organization, actor=request.user
        ):
            return Response(status=404)

        validator = ConfigurationContainerValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data["data"]

        make_storage(project).set(result)
        return Response({"data": result}, status=201)

    def delete(self, request: Request, project: Project) -> Response:
        """Delete remote configuration from project options."""
        if not features.has(
            "organizations:remote-config", project.organization, actor=request.user
        ):
            return Response(status=404)

        make_storage(project).pop()
        return Response("", status=204)
