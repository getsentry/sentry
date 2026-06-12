from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.environments import environment_visibility_filter_options
from sentry.api.serializers import serialize
from sentry.api.serializers.models.environment import (
    EnvironmentProjectSerializer,
    EnvironmentProjectSerializerResponse,
)
from sentry.api.serializers.rest_framework.environment import BulkEnvironmentSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.environment_examples import EnvironmentExamples
from sentry.apidocs.parameters import EnvironmentParams, GlobalParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.environment import EnvironmentProject


@extend_schema(tags=["Environments"])
@cell_silo_endpoint
class ProjectEnvironmentsEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUE_DETECTION_BACKEND
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="listProjectEnvironments",
        summary="List a Project's Environments",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            EnvironmentParams.VISIBILITY,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListProjectEnvironments", list[EnvironmentProjectSerializerResponse]
            ),
            400: OpenApiResponse(description="Invalid value for 'visibility'."),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=EnvironmentExamples.GET_PROJECT_ENVIRONMENTS,
    )
    def get(
        self, request: Request, project
    ) -> Response[list[EnvironmentProjectSerializerResponse]] | Response[DetailResponse]:
        """
        Lists a project's environments.
        """

        queryset = (
            EnvironmentProject.objects.filter(
                project=project,
                # Including the organization_id is necessary for postgres to use indexes
                # efficiently.
                environment__organization_id=project.organization_id,
            )
            .exclude(
                # HACK(mattrobenolt): We don't want to surface the
                # "No Environment" environment to the UI since it
                # doesn't really exist. This might very likely change
                # with new tagstore backend in the future, but until
                # then, we're hiding it since it causes more problems
                # than it's worth.
                environment__name=""
            )
            .select_related("environment")
            .order_by("environment__name")
        )

        visibility = request.GET.get("visibility", "visible")
        if visibility not in environment_visibility_filter_options:
            return Response(
                {
                    "detail": f"Invalid value for 'visibility', valid values are: {sorted(environment_visibility_filter_options.keys())!r}"
                },
                status=400,
            )

        add_visibility_filters = environment_visibility_filter_options[visibility]
        queryset = add_visibility_filters(queryset)

        items: list[EnvironmentProject] = list(queryset)
        return Response(serialize(items, request.user, EnvironmentProjectSerializer()))

    @extend_schema(
        operation_id="Bulk Update Project Environments",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=BulkEnvironmentSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "BulkUpdateProjectEnvironments", list[EnvironmentProjectSerializerResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=EnvironmentExamples.GET_PROJECT_ENVIRONMENTS,
    )
    def put(
        self, request: Request, project
    ) -> Response[list[EnvironmentProjectSerializerResponse]] | Response[ValidationErrorResponse]:
        """
        Bulk update the visibility for a project's environments.
        """
        serializer = BulkEnvironmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

        data = serializer.validated_data
        environment_names = data["environmentNames"]
        is_hidden = data["isHidden"]

        base_queryset = EnvironmentProject.objects.filter(
            project=project,
            environment__organization_id=project.organization_id,
            environment__name__in=environment_names,
        ).exclude(environment__name="")

        base_queryset.update(is_hidden=is_hidden)

        queryset = base_queryset.select_related("environment").order_by("environment__name")

        items: list[EnvironmentProject] = list(queryset)
        return Response(serialize(items, request.user, EnvironmentProjectSerializer()))
