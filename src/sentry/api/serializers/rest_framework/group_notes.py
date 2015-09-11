from __future__ import absolute_import

from rest_framework import serializers


class NoteSerializer(serializers.Serializer):
    text = serializers.CharField()
