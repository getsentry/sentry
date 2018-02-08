from __future__ import absolute_import

import itertools
from rest_framework import serializers

from .list import ListField
from sentry.api.fields.actor import ActorField

from sentry.models import User, Team


def seperateActorIds(actor_ids):
    """Accepts a list of ids which correspond to actors, be that teams or users
    team ids are prefixes with `team:`, user ids are prefixed with `user:`
    Note: ids with no prefix are assumed to be user ids."""
    members = [actor_id[5:] for actor_id in actor_ids if actor_id.startswith("user:")]
    legacy_members = [actor_id for actor_id in actor_ids if actor_id.isdigit()]

    teams = [actor_id[5:] for actor_id in actor_ids if actor_id.startswith("team:")]

    return {'users': list(itertools.chain(members, legacy_members)), 'teams': teams}


def seperateActors(actors):
    """Accepts a list of ids which correspond to actors, be that teams or users
    team ids are prefixes with `team:`, user ids are prefixed with `user:`
    Note: ids with no prefix are assumed to be user ids."""
    users = [actor for actor in actors if isinstance(actor, User)]
    teams = [actor for actor in actors if isinstance(actor, Team)]

    return {'users': users, 'teams': teams}


class NoteSerializer(serializers.Serializer):
    text = serializers.CharField()
    mentions = ListField(child=ActorField(), required=False)

    def validate_mentions(self, attrs, source):
        if source in attrs and 'group' in self.context:
            mentions = seperateActors(attrs[source])
            users = mentions['users']

            mentioned_user_ids = [user.id for user in users]

            project = self.context['group'].project

            member_ids = set(
                project.member_set.filter(user_id__in=mentioned_user_ids)
                .values_list('user_id', flat=True)
            )

            invalid_user_ids = [m for m in mentioned_user_ids if int(m) not in member_ids]

            if invalid_user_ids:
                raise serializers.ValidationError('Cannot mention a non team member')

            teams = mentions['teams']
            mentioned_team_ids = [team.id for team in teams]

            team_ids = set(
                project.teams.filter(id__in=mentioned_team_ids)
                .values_list('id', flat=True)
            )

            invalid_team_ids = [m for m in mentioned_team_ids if int(m) not in team_ids]

            if invalid_team_ids:
                raise serializers.ValidationError('Mentioned team not found')

        return attrs
