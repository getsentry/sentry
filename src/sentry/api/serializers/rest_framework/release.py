from __future__ import absolute_import

from rest_framework import serializers

from sentry.api.serializers.rest_framework import CommitSerializer, ListField
from sentry.api.fields.user import UserField
from sentry.constants import COMMIT_RANGE_DELIMITER, MAX_COMMIT_LENGTH, MAX_VERSION_LENGTH
from sentry.models import Release


class ReleaseHeadCommitSerializerDeprecated(serializers.Serializer):
    currentId = serializers.CharField(max_length=MAX_COMMIT_LENGTH)
    repository = serializers.CharField(max_length=64)
    previousId = serializers.CharField(
        max_length=MAX_COMMIT_LENGTH, required=False, allow_null=True
    )


class ReleaseHeadCommitSerializer(serializers.Serializer):
    commit = serializers.CharField()
    repository = serializers.CharField(max_length=200)
    previousCommit = serializers.CharField(
        max_length=MAX_COMMIT_LENGTH, required=False, allow_null=True, allow_blank=True
    )

    def validate_commit(self, value):
        """
        Value can be either a single commit or a commit range (1a2b3c..6f5e4d)
        """

        if COMMIT_RANGE_DELIMITER in value:
            startCommit, endCommit = value.split(COMMIT_RANGE_DELIMITER)

            if not startCommit or not endCommit:
                raise serializers.ValidationError(
                    "Commit cannot begin or end with %s" % COMMIT_RANGE_DELIMITER
                )

            if len(startCommit) > MAX_COMMIT_LENGTH or len(endCommit) > MAX_COMMIT_LENGTH:
                raise serializers.ValidationError(
                    "Start or end commit too long - max is %s chars each" % MAX_COMMIT_LENGTH
                )

            return value

        if len(value) > MAX_COMMIT_LENGTH:
            raise serializers.ValidationError(
                "Commit too long - max is %s chars" % MAX_COMMIT_LENGTH
            )

        return value


class ReleaseSerializer(serializers.Serializer):
    ref = serializers.CharField(
        max_length=MAX_VERSION_LENGTH, required=False, allow_null=True, allow_blank=True
    )
    url = serializers.URLField(required=False, allow_null=True, allow_blank=True)
    dateReleased = serializers.DateTimeField(required=False, allow_null=True)
    commits = ListField(child=CommitSerializer(), required=False, allow_null=False)


class ReleaseWithVersionSerializer(ReleaseSerializer):
    version = serializers.CharField(
        max_length=MAX_VERSION_LENGTH, trim_whitespace=False, required=True
    )
    owner = UserField(required=False)

    def validate_version(self, value):
        if not Release.is_valid_version(value):
            raise serializers.ValidationError("Release with name %s is not allowed" % value)
        return value
