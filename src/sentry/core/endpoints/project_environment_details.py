from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.environment import EnvironmentProjectSerializer
from sentry.api.serializers.rest_framework.environment import EnvironmentSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.environment_examples import EnvironmentExamples
from sentry.apidocs.parameters import EnvironmentParams, GlobalParams
from sentry.models.environment import Environment, EnvironmentProject


@extend_schema(tags=["Environments"])
@region_silo_endpoint
class ProjectEnvironmentDetailsEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve a Project Environment",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            EnvironmentParams.ENVIRONMENT,
        ],
        responses={
            200: EnvironmentProjectSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=EnvironmentExamples.RETRIEVE_PROJECT_ENVIRONMENT,
    )
    def get(self, request: Request, project, environment) -> Response:
        """
        Return details on a project environment.
        """
        try:
            instance = EnvironmentProject.objects.select_related("environment").get(
                project=project,
                environment__name=Environment.get_name_from_path_segment(environment),
            )
        except EnvironmentProject.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(instance, request.user))

    @extend_schema(
        operation_id="Update a Project Environment",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            EnvironmentParams.ENVIRONMENT,
        ],
        request=EnvironmentSerializer,
        responses={
            200: EnvironmentProjectSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=EnvironmentExamples.RETRIEVE_PROJECT_ENVIRONMENT,
    )
    def put(self, request: Request, project, environment) -> Response:
        """
        Update the visibility for a project environment.
        """
        try:
            instance = EnvironmentProject.objects.select_related("environment").get(
                project=project,
                environment__name=Environment.get_name_from_path_segment(environment),
            )
        except EnvironmentProject.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = EnvironmentSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        fields = {}

        if "isHidden" in data:
            fields["is_hidden"] = data["isHidden"]

        if fields:
            instance.update(**fields)

        return Response(serialize(instance, request.user))
