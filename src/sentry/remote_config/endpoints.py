from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.remote_config.storage import make_storage


class ConfigurationValidator(Serializer):
    id = serializers.UUIDField(read_only=True)
    sample_rate = serializers.FloatField(max_value=1.0, min_value=0, required=True)
    traces_sample_rate = serializers.FloatField(max_value=1.0, min_value=0, required=True)
    user_config = serializers.JSONField(required=True, allow_null=True)


class ConfigurationContainerValidator(Serializer):
    data = ConfigurationValidator()  # type: ignore[assignment]


@region_silo_endpoint
class ProjectConfigurationEndpoint(ProjectEndpoint):
    owner = ApiOwner.CONFIGURATIONS
    permission_classes = (ProjectEventPermission,)
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }

    def convert_args(self, request: Request, key_id: str, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        project = kwargs["project"]

        try:
            key = ProjectKey.objects.for_request(request).get(project=project, public_key=key_id)
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        kwargs["key"] = key
        return args, kwargs

    def get(self, request: Request, project: Project, key: ProjectKey) -> Response:
        """Get remote configuration from project options."""
        remote_config = make_storage(key).get()
        if remote_config is None:
            return Response("Not found.", status=404)
        return Response({"data": remote_config}, status=200)

    def post(self, request: Request, project: Project, key: ProjectKey) -> Response:
        """Set remote configuration in project options."""
        validator = ConfigurationContainerValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data["data"]

        # Propagate config to Relay.
        make_storage(key).set(result)

        result["id"] = key.public_key
        return Response({"data": result}, status=201)

    def delete(self, request: Request, project: Project, key: ProjectKey) -> Response:
        """Delete remote configuration from project options."""
        make_storage(key).pop()
        return Response("", status=204)
