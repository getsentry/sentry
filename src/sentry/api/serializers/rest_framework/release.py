from __future__ import absolute_import

from rest_framework import serializers

from sentry.api.serializers.rest_framework import CommitSerializer, ListField
from sentry.constants import VERSION_LENGTH


class ReleaseHeadCommitSerializerDeprecated(serializers.Serializer):
    currentId = serializers.CharField(max_length=64)
    repository = serializers.CharField(max_length=64)
    previousId = serializers.CharField(max_length=64, required=False)


class ReleaseHeadCommitSerializer(serializers.Serializer):
    commit = serializers.CharField(max_length=64)
    repository = serializers.CharField(max_length=64)
    previousCommit = serializers.CharField(max_length=64, required=False)


class ReleaseSerializer(serializers.Serializer):
    ref = serializers.CharField(max_length=VERSION_LENGTH, required=False)
    url = serializers.URLField(required=False)
    dateReleased = serializers.DateTimeField(required=False)
    commits = ListField(child=CommitSerializer(), required=False, allow_null=False)

    def validate_ref(self, attrs, source):
        value = attrs[source]
        if not self.check_release_name(value):
            raise serializers.ValidationError('Release with name %s is not allowed' % value)
        return attrs

    def check_release_name(self, name):
        return name.lower() != 'latest'


class OrganizationReleaseSerializer(ReleaseSerializer):
    headCommits = ListField(
        child=ReleaseHeadCommitSerializerDeprecated(),
        required=False,
        allow_null=False
    )
    refs = ListField(
        child=ReleaseHeadCommitSerializer(),
        required=False,
        allow_null=False,
    )
