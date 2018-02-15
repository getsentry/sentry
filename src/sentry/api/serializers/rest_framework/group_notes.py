from __future__ import absolute_import

from rest_framework import serializers

from .list import ListField
from sentry.api.fields.actor import ActorField

from sentry.models import User, Team


def seperate_actors(actors):
    users = [actor for actor in actors if actor.type is User]
    teams = [actor for actor in actors if actor.type is Team]

    return {'users': users, 'teams': teams}


def seperate_resolved_actors(actors):
    users = [actor for actor in actors if isinstance(actor, User)]
    teams = [actor for actor in actors if isinstance(actor, Team)]

    return {'users': users, 'teams': teams}


class NoteSerializer(serializers.Serializer):
    text = serializers.CharField()
    mentions = ListField(child=ActorField(), required=False)

    def validate_mentions(self, attrs, source):
        if source in attrs and 'group' in self.context:

            mentions = attrs[source]
            seperated_actors = seperate_actors(mentions)
            # Validate that all mentioned users exist and are on the project.
            users = seperated_actors['users']

            mentioned_user_ids = {user.id for user in users}

            project = self.context['group'].project

            user_ids = set(
                project.member_set.filter(user_id__in=mentioned_user_ids)
                .values_list('user_id', flat=True)
            )

            if len(mentioned_user_ids) > len(user_ids):
                raise serializers.ValidationError('Cannot mention a non team member')

            # Validate that all mentioned teams exist and are on the project.
            teams = seperated_actors['teams']
            mentioned_team_ids = {team.id for team in teams}

            if len(mentioned_team_ids) > project.teams.filter(
                    id__in={t.id for t in teams}).count():
                raise serializers.ValidationError(
                    'Mentioned team not found or not associated with project')

        return attrs
