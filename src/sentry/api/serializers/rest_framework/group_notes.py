from __future__ import absolute_import

from rest_framework import serializers

from .list import ListField


class NoteSerializer(serializers.Serializer):
    text = serializers.CharField()

class MentionSerializer(serializers.Serializer):
    import pdb; pdb.set_trace()
    mentions = ListField(
        child=serializers.CharField(),
        required=False,
    )
