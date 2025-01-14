from __future__ import annotations

from typing import TypedDict

from rest_framework import serializers
from rest_framework.serializers import ListField

from sentry.api.fields.actor import ActorField
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.types.actor import Actor


class _SeparatedActors(TypedDict):
    users: list[Actor]
    teams: list[Actor]


def separate_actors(actors: list[Actor]) -> _SeparatedActors:
    users = [actor for actor in actors if actor.is_user]
    teams = [actor for actor in actors if actor.is_team]

    return {"users": users, "teams": teams}


class NoteSerializer(serializers.Serializer[None]):
    text = serializers.CharField()
    mentions = ListField(child=ActorField(), required=False)
    external_id = serializers.CharField(allow_null=True, required=False)

    def validate_mentions(self, mentions: list[Actor]) -> list[Actor]:
        if mentions and "projects" in self.context:

            separated_actors = separate_actors(mentions)
            # Validate that all mentioned users exist and are on the project.
            users = separated_actors["users"]

            mentioned_user_ids = {user.id for user in users}

            projects = self.context["projects"]
            user_ids = list(
                OrganizationMember.objects.filter(
                    teams__projectteam__project__in=[p.id for p in projects],
                    user_id__in=mentioned_user_ids,
                ).values_list("user_id", flat=True)
            )

            if len(mentioned_user_ids) > len(user_ids):
                raise serializers.ValidationError("Cannot mention a non team member")

            # Validate that all mentioned teams exist and are on the project.
            teams = separated_actors["teams"]
            mentioned_team_ids = {team.id for team in teams}
            if (
                len(mentioned_team_ids)
                > Team.objects.filter(
                    id__in=mentioned_team_ids, projectteam__project__in=projects
                ).count()
            ):
                raise serializers.ValidationError(
                    "Mentioned team not found or not associated with project"
                )

        return mentions
