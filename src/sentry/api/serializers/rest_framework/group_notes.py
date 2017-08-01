from __future__ import absolute_import

from rest_framework import serializers

from .list import ListField


class NoteSerializer(serializers.Serializer):
    text = serializers.CharField()
    mentions = ListField(required=False)

    def validate_mentions(self, attrs, source):
        if source in attrs and 'group' in self.context:
            mentions = attrs[source]
            project = self.context['group'].project
            member_ids = set(
                project.member_set.filter(user_id__in=mentions).values_list('user_id', flat=True)
            )
            invalid_user_ids = [m for m in mentions if int(m) not in member_ids]
            if invalid_user_ids:
                raise serializers.ValidationError('Cannot mention a non-team member')

        return attrs
