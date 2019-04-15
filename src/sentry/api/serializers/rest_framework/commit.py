from __future__ import absolute_import

from rest_framework import serializers
from sentry.api.serializers.rest_framework.list import ListField
from sentry.models import CommitFileChange


class CommitPatchSetSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=255)
    type = serializers.CharField(max_length=1)

    def validate_type(self, attrs, source):
        value = attrs[source]
        if not CommitFileChange.is_valid_type(value):
            raise serializers.ValidationError('Commit patch_set type %s is not supported.' % value)
        return attrs


class CommitSerializer(serializers.Serializer):
    id = serializers.CharField(max_length=64)
    repository = serializers.CharField(max_length=64, required=False)
    message = serializers.CharField(required=False)
    author_name = serializers.CharField(max_length=128, required=False)
    author_email = serializers.EmailField(max_length=75, required=False)
    timestamp = serializers.DateTimeField(required=False)
    patch_set = ListField(
        child=CommitPatchSetSerializer(required=False),
        required=False,
        allow_null=True,
    )
