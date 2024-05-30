from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.helpers.environments import environment_visibility_filter_options
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.examples.environment_examples import EnvironmentExamples
from sentry.apidocs.parameters import EnvironmentParams, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.environment import Environment, EnvironmentProject


class OrganizationEnvironmentResponseType(TypedDict):
    id: int
    name: str


@extend_schema(tags=["Environments"])
@region_silo_endpoint
class OrganizationEnvironmentsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.UNOWNED
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="List an Organization's Environments",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, EnvironmentParams.VISIBILITY],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationEnvironmentResponse", list[OrganizationEnvironmentResponseType]
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=EnvironmentExamples.GET_ORGANIZATION_ENVIRONMENTS,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Lists an organization's environments.
        """
        visibility = request.GET.get("visibility", "visible")
        if visibility not in environment_visibility_filter_options:
            return Response(
                {
                    "detail": "Invalid value for 'visibility', valid values are: {!r}".format(
                        sorted(environment_visibility_filter_options.keys())
                    )
                },
                status=400,
            )
        environment_projects = EnvironmentProject.objects.filter(
            project__in=self.get_projects(request, organization)
        )
        add_visibility_filters = environment_visibility_filter_options[visibility]
        environment_projects = add_visibility_filters(environment_projects).values("environment")
        queryset = (
            Environment.objects.filter(id__in=environment_projects)
            .exclude(
                # HACK(mattrobenolt): We don't want to surface the
                # "No Environment" environment to the UI since it
                # doesn't really exist. This might very likely change
                # with new tagstore backend in the future, but until
                # then, we're hiding it since it causes more problems
                # than it's worth.
                name=""
            )
            .order_by("name")
        )
        return Response(serialize(list(queryset), request.user))
