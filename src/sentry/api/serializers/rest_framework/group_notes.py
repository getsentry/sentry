from __future__ import absolute_import

import itertools
from rest_framework import serializers

from .list import ListField


def seperateActorIds(actor_ids):
    members = [actor_id[5:] for actor_id in actor_ids if actor_id.startswith("user:")]
    legacy_members = [actor_id for actor_id in actor_ids if actor_id.isdigit()]

    teams = [actor_id[5:] for actor_id in actor_ids if actor_id.startswith("team:")]

    return {'members': itertools.chain(members, legacy_members), 'teams': teams}


class NoteSerializer(serializers.Serializer):
    text = serializers.CharField()
    mentions = ListField(required=False)

    def validate_mentions(self, attrs, source):
        if source in attrs and 'group' in self.context:
            mentions = attrs[source]

            seperatedActors = seperateActorIds(mentions)

            project = self.context['group'].project

            member_ids = set(
                project.member_set.filter(
                    user_id__in=seperatedActors['members']).values_list(
                    'user_id', flat=True)
            )

            invalid_user_ids = [m for m in seperatedActors['members'] if int(m) not in member_ids]

            if invalid_user_ids:
                raise serializers.ValidationError('Cannot mention a non-team member')

            team_ids = set(
                project.teams.filter(
                    id__in=seperatedActors['teams']).values_list(
                    'id', flat=True)
            )

            invalid_team_ids = [m for m in seperatedActors['teams'] if int(m) not in team_ids]

            if invalid_team_ids:
                raise serializers.ValidationError('Mentioned team not found')

        return attrs
