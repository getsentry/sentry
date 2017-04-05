from __future__ import absolute_import

from rest_framework import serializers


class ReleaseHeadCommitSerializerDeprecated(serializers.Serializer):
    currentId = serializers.CharField(max_length=64)
    repository = serializers.CharField(max_length=64)
    previousId = serializers.CharField(max_length=64, required=False)


class ReleaseHeadCommitSerializer(serializers.Serializer):
    commit = serializers.CharField(max_length=64)
    repository = serializers.CharField(max_length=64)
    previousCommit = serializers.CharField(max_length=64, required=False)
