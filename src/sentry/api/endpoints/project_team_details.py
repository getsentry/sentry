from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import ProjectWithTeamSerializer
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.project_examples import ProjectExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.models.team import Team


class ProjectTeamsPermission(ProjectPermission):
    scope_map = {
        "POST": ["project:write", "project:admin"],
        # allow deletes with write permission because it's just removing
        # a team from a project and not anything more destructive
        "DELETE": ["project:write", "project:admin"],
    }


@extend_schema(tags=["Projects"])
@region_silo_endpoint
class ProjectTeamDetailsEndpoint(ProjectEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (ProjectTeamsPermission,)

    @extend_schema(
        operation_id="Add a Team to a Project",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            GlobalParams.TEAM_SLUG,
        ],
        request=None,
        responses={
            201: ProjectWithTeamSerializer,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.ADD_TEAM_TO_PROJECT,
    )
    def post(self, request: Request, project, team_slug) -> Response:
        """
        Give a team access to a project.
        """
        try:
            team = Team.objects.get(organization_id=project.organization_id, slug=team_slug)
        except Team.DoesNotExist:
            raise ResourceDoesNotExist(detail="Team does not exist.")

        # A user with project:write can grant access to this project to other user/teams
        project.add_team(team)
        return Response(serialize(project, request.user, ProjectWithTeamSerializer()), status=201)

    @extend_schema(
        operation_id="Delete a Team from a Project",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            GlobalParams.TEAM_SLUG,
        ],
        request=None,
        responses={
            200: ProjectWithTeamSerializer,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.DELETE_TEAM_FROM_PROJECT,
    )
    def delete(self, request: Request, project, team_slug) -> Response:
        """
        Revoke a team's access to a project.

        Note that Team Admins can only revoke access to teams they are admins of.
        """
        try:
            team = Team.objects.get(organization_id=project.organization_id, slug=team_slug)
        except Team.DoesNotExist:
            raise ResourceDoesNotExist(detail="Team does not exist.")

        if not request.access.has_team_scope(team, "project:write"):
            return Response(
                {"detail": ["You do not have permission to perform this action."]}, status=403
            )
        project.remove_team(team)

        return Response(serialize(project, request.user, ProjectWithTeamSerializer()), status=200)
