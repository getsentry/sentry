from __future__ import annotations

from typing import Sequence

from rest_framework import serializers

from sentry.models.actor import ActorTuple
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team
from sentry.models.user import User
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.util import region_silo_function


@region_silo_function
def extract_user_ids_from_mentions(organization_id, mentions):
    """
    Extracts user ids from a set of mentions. Mentions should be a list of
    `ActorTuple` instances. Returns a dictionary with 'users', 'team_users', and 'teams' keys.
    'users' is the user ids for all explicitly mentioned users, 'team_users'
    is all user ids from explicitly mentioned teams, excluding any already
    mentioned users, and 'teams' is the team ids for all explicitly mentioned teams.
    """
    actors: Sequence[RpcUser | Team] = ActorTuple.resolve_many(mentions)
    actor_mentions = separate_resolved_actors(actors)

    team_user_ids = set(
        OrganizationMemberTeam.objects.filter(
            team_id__in=[t.id for t in actor_mentions["teams"]],
            organizationmember__user_id__isnull=False,
            organizationmember__user_is_active=True,
            organizationmember__organization_id=organization_id,
            is_active=True,
        ).values_list("organizationmember__user_id", flat=True)
    )
    mentioned_team_users = team_user_ids - set({u.id for u in actor_mentions["users"]})

    return {
        "users": {user.id for user in actor_mentions["users"]},
        "team_users": set(mentioned_team_users),
        "teams": {team.id for team in actor_mentions["teams"]},
    }


def separate_actors(actors):
    users = [actor for actor in actors if actor.type is User]
    teams = [actor for actor in actors if actor.type is Team]

    return {"users": users, "teams": teams}


def separate_resolved_actors(actors: Sequence[RpcUser | Team]):
    users = [actor for actor in actors if actor.class_name() == "User"]
    teams = [actor for actor in actors if isinstance(actor, Team)]

    return {"users": users, "teams": teams}


class MentionsMixin:
    def validate_mentions(self, mentions):
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
