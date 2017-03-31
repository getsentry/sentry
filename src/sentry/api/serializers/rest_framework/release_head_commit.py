from __future__ import absolute_import

from rest_framework import serializers


class ReleaseHeadCommitSerializer(serializers.Serializer):
    current_id = serializers.CharField(max_length=64)
    repository = serializers.CharField(max_length=64)
    previous_id = serializers.CharField(max_length=64, required=False)
