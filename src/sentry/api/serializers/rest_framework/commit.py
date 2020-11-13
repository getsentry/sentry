from __future__ import absolute_import

from rest_framework import serializers
from sentry.api.serializers.rest_framework.list import ListField
from sentry.models import CommitFileChange


class CommitPatchSetSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=255)
    type = serializers.CharField(max_length=1)

    def validate_type(self, value):
        if not CommitFileChange.is_valid_type(value):
            raise serializers.ValidationError("Commit patch_set type %s is not supported." % value)
        return value


class CommitSerializer(serializers.Serializer):
    id = serializers.CharField(max_length=64)
    repository = serializers.CharField(
        max_length=64, required=False, allow_null=True, allow_blank=True
    )
    message = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    author_name = serializers.CharField(
        max_length=128, required=False, allow_null=True, allow_blank=True
    )
    author_email = serializers.CharField(
        max_length=75, required=False, allow_null=True, allow_blank=True,
    )
    timestamp = serializers.DateTimeField(required=False, allow_null=True)
    patch_set = ListField(
        child=CommitPatchSetSerializer(required=False), required=False, allow_null=True
    )
