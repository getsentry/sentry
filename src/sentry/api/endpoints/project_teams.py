from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import BaseTeamSerializerResponse
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.team_examples import TeamExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.team import Team


@region_silo_endpoint
@extend_schema(tags=["Teams"])
class ProjectTeamsEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ENTERPRISE

    @extend_schema(
        operation_id="List a Project's Teams",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ProjectTeamsResponse", list[BaseTeamSerializerResponse]
            ),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=TeamExamples.LIST_PROJECT_TEAMS,
    )
    def get(self, request: Request, project) -> Response:
        """
        Return a list of teams that have access to this project.
        """
        queryset = Team.objects.filter(projectteam__project=project)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="name",
            paginator_cls=OffsetPaginator,
            on_results=lambda team: serialize(team, request.user),
        )
