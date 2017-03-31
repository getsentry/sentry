from __future__ import absolute_import

from rest_framework import serializers


class ReleaseHeadCommitSerializer(serializers.Serializer):
    currentId = serializers.CharField(max_length=64)
    repository = serializers.CharField(max_length=64)
    previousId = serializers.CharField(max_length=64, required=False)
