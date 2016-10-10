from __future__ import absolute_import

from rest_framework import serializers


class CommitSerializer(serializers.Serializer):
    id = serializers.CharField(max_length=64)
    repository = serializers.CharField(max_length=64, required=False)
    message = serializers.CharField(required=False)
    author_name = serializers.CharField(max_length=128, required=False)
    author_email = serializers.EmailField(max_length=75, required=False)
    timestamp = serializers.DateTimeField(required=False)
