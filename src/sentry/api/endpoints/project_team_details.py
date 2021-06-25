from django.http import Http404
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import ProjectWithTeamSerializer
from sentry.models import NotificationSetting, Team
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.types.integrations import ExternalProviders


class ProjectTeamsPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:write", "project:admin"],
        # allow deletes with write permission because it's just removing
        # a team from a project and not anything more destructive
        "DELETE": ["project:write", "project:admin"],
    }


class ProjectTeamDetailsEndpoint(ProjectEndpoint):
    permission_classes = (ProjectTeamsPermission,)

    def post(self, request, project, team_slug):
        """
        Give a team access to a project
        ```````````````````````````````
        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :pparam string team_slug: the slug of the team.
        :auth: required
        """
        try:
            team = Team.objects.get(organization_id=project.organization_id, slug=team_slug)
        except Team.DoesNotExist:
            raise Http404
        if not request.access.has_team_scope(team, "project:write"):
            return Response(
                {"detail": ["You do not have permission to perform this action."]}, status=403
            )
        project.add_team(team)
        # if the team has Slack notifications enabled, update
        team_settings = NotificationSetting.objects.filter(
            provider=ExternalProviders.SLACK.value,
            scope_type=NotificationScopeType.PROJECT.value,
            target=team.actor.id,
        ).exists()
        if team_settings:
            NotificationSetting.objects.update_settings(
                ExternalProviders.SLACK,
                NotificationSettingTypes.ISSUE_ALERTS,
                NotificationSettingOptionValues.ALWAYS,
                team=team,
                project=project,
            )
        return Response(serialize(project, request.user, ProjectWithTeamSerializer()), status=201)

    def delete(self, request, project, team_slug):
        """
        Revoke a team's access to a project
        ```````````````````````````````````
        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :pparam string team_slug: the slug of the team.
        :auth: required
        """
        try:
            team = Team.objects.get(organization_id=project.organization_id, slug=team_slug)
        except Team.DoesNotExist:
            raise Http404

        if not request.access.has_team_scope(team, "project:write"):
            return Response(
                {"detail": ["You do not have permission to perform this action."]}, status=403
            )
        project.remove_team(team)
        team_settings = NotificationSetting.objects.filter(
            provider=ExternalProviders.SLACK.value,
            scope_type=NotificationScopeType.PROJECT.value,
            target=team.actor.id,
            scope_identifier=project.id,
        ).exists()
        if team_settings:
            NotificationSetting.objects.remove_settings(
                ExternalProviders.SLACK,
                NotificationSettingTypes.ISSUE_ALERTS,
                team=team,
                project=project,
            )
        return Response(serialize(project, request.user, ProjectWithTeamSerializer()), status=200)
