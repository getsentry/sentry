from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.configurations.storage import make_storage
from sentry.models.project import Project


class ConfigurationValidator(Serializer):
    id = serializers.IntegerField(read_only=True)
    sample_rate = serializers.FloatField(max_value=1.0, min_value=0, required=True)
    traces_sample_rate = serializers.FloatField(max_value=1.0, min_value=0, required=True)
    user_config = serializers.JSONField(required=True)


class ConfigurationContainerValidator(Serializer):
    data = ConfigurationValidator()


@region_silo_endpoint
class ProjectConfigurationEndpoint(ProjectEndpoint):
    owner = ApiOwner.CONFIGURATIONS
    permission_classes = (ProjectEventPermission,)
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project: Project) -> Response:
        """Get remote configuration from project options."""
        remote_config = make_storage(project).get()
        if remote_config is None:
            return Response("Not found.", status=404)
        return Response({"data": remote_config}, status=200)

    def post(self, request: Request, project: Project) -> Response:
        """Set remote configuration in project options."""
        validator = ConfigurationContainerValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data["data"]

        # Propagate config to Relay.
        make_storage(project).set(result)

        result["id"] = project.id
        return Response({"data": result}, status=201)

    def delete(self, request: Request, project: Project) -> Response:
        """Delete remote configuration from project options."""
        make_storage(project).pop()
        return Response("", status=204)
