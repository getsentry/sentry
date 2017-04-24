from __future__ import absolute_import

from rest_framework import serializers

from .list import ListField


class NoteSerializer(serializers.Serializer):
    text = serializers.CharField()
    mentions = ListField(required=False)
