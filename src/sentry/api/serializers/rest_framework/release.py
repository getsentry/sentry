from __future__ import absolute_import

from rest_framework import serializers

from sentry.api.serializers.rest_framework import CommitSerializer, ListField
from sentry.api.fields.user import UserField
from sentry.constants import VERSION_LENGTH
from sentry.models import Release


class ReleaseHeadCommitSerializerDeprecated(serializers.Serializer):
    currentId = serializers.CharField(max_length=64)
    repository = serializers.CharField(max_length=64)
    previousId = serializers.CharField(max_length=64, required=False)


class ReleaseHeadCommitSerializer(serializers.Serializer):
    commit = serializers.CharField(max_length=64)
    repository = serializers.CharField(max_length=200)
    previousCommit = serializers.CharField(max_length=64, required=False)


class ReleaseSerializer(serializers.Serializer):
    ref = serializers.CharField(max_length=VERSION_LENGTH, required=False)
    url = serializers.URLField(required=False)
    dateReleased = serializers.DateTimeField(required=False)
    commits = ListField(child=CommitSerializer(), required=False, allow_null=False)


class ReleaseWithVersionSerializer(ReleaseSerializer):
    version = serializers.CharField(max_length=VERSION_LENGTH, required=True)
    owner = UserField(required=False)

    def validate_version(self, attrs, source):
        value = attrs[source]
        if not Release.is_valid_version(value):
            raise serializers.ValidationError('Release with name %s is not allowed' % value)
        return attrs
