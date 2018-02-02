from __future__ import absolute_import

from rest_framework import serializers

from .list import ListField


class NoteSerializer(serializers.Serializer):
    text = serializers.CharField()
    mentions = ListField(required=False)
    teamMentions = ListField(required=False)

    def validate_mentions(self, attrs, source):
        if source in attrs and 'group' in self.context:
            memberMentions = attrs[source]
            project = self.context['group'].project

            member_ids = set(
                project.member_set.filter(
                    user_id__in=memberMentions).values_list(
                    'user_id', flat=True)
            )

            invalid_user_ids = [m for m in memberMentions if int(m) not in member_ids]

            if invalid_user_ids:
                raise serializers.ValidationError('Cannot mention a non-team member')

        return attrs

    def validate_teamMentions(self, attrs, source):
        if source in attrs and 'group' in self.context:
            teamMentions = attrs[source]
            project = self.context['group'].project

            team_ids = set(
                project.teams.filter(
                    id__in=teamMentions).values_list(
                    'id', flat=True)
            )

            invalid_team_ids = [m for m in teamMentions if int(m) not in team_ids]

            if invalid_team_ids:
                raise serializers.ValidationError('Mentioned team not found')

        return attrs
