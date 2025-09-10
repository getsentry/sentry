from typing import NotRequired, TypedDict

from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from sentry.api.helpers.group_index.validators.in_commit import InCommitResult, InCommitValidator
from sentry.models.release import Release


class StatusDetailsResult(TypedDict):
    inFutureRelease: NotRequired[str]
    inNextRelease: NotRequired[bool]
    inRelease: NotRequired[str]
    inCommit: NotRequired[InCommitResult]
    ignoreDuration: NotRequired[int]
    ignoreCount: NotRequired[int]
    ignoreWindow: NotRequired[int]
    ignoreUserCount: NotRequired[int]
    ignoreUserWindow: NotRequired[int]


@extend_schema_serializer()
class StatusDetailsValidator(serializers.Serializer[StatusDetailsResult]):
    inFutureRelease = serializers.CharField(
        help_text="The version of the future release that the issue should be resolved in."
    )
    inNextRelease = serializers.BooleanField(
        help_text="If true, marks the issue as resolved in the next release."
    )
    inRelease = serializers.CharField(
        help_text=(
            "The version of the release that the issue should be resolved in."
            "If set to `latest`, the latest release will be used."
        )
    )
    inCommit = InCommitValidator(
        help_text="The commit data that the issue should use for resolution.", required=False
    )
    ignoreDuration = serializers.IntegerField(
        help_text="Ignore the issue until for this many minutes."
    )
    ignoreCount = serializers.IntegerField(
        help_text="Ignore the issue until it has occurred this many times in `ignoreWindow` minutes."
    )
    ignoreWindow = serializers.IntegerField(
        help_text="Ignore the issue until it has occurred `ignoreCount` times in this many minutes. (Max: 1 week)",
        max_value=7 * 24 * 60,
    )
    ignoreUserCount = serializers.IntegerField(
        help_text="Ignore the issue until it has affected this many users in `ignoreUserWindow` minutes."
    )
    ignoreUserWindow = serializers.IntegerField(
        help_text="Ignore the issue until it has affected `ignoreUserCount` users in this many minutes. (Max: 1 week)",
        max_value=7 * 24 * 60,
    )

    def validate_inRelease(self, value: str) -> Release:
        project = self.context["project"]
        if value == "latest":
            try:
                return (
                    Release.objects.filter(
                        projects=project, organization_id=project.organization_id
                    )
                    .extra(select={"sort": "COALESCE(date_released, date_added)"})
                    .order_by("-sort")[0]
                )
            except IndexError:
                raise serializers.ValidationError(
                    "No release data present in the system to form a basis for 'Next Release'"
                )
        else:
            try:
                return Release.objects.get(
                    projects=project, organization_id=project.organization_id, version=value
                )
            except Release.DoesNotExist:
                raise serializers.ValidationError(
                    "Unable to find a release with the given version."
                )

    def validate_inNextRelease(self, value: bool) -> "Release":
        project = self.context["project"]
        try:
            return (
                Release.objects.filter(projects=project, organization_id=project.organization_id)
                .extra(select={"sort": "COALESCE(date_released, date_added)"})
                .order_by("-sort")[0]
            )
        except IndexError:
            raise serializers.ValidationError(
                "No release data present in the system to form a basis for 'Next Release'"
            )

    def validate_inFutureRelease(self, value: str) -> tuple["Release | None", str]:
        project = self.context["project"]

        if not Release.is_valid_version(value):
            raise serializers.ValidationError(
                "Invalid release version format. Please use a valid version string or package@version format."
            )

        if "@" in value:
            if not Release.is_semver_version(value):
                raise serializers.ValidationError(
                    "Invalid semver format. Please use format: package@major.minor.patch[-prerelease][+build]"
                )

        try:
            release = Release.objects.get(
                projects=project, organization_id=project.organization_id, version=value
            )
            return release, value
        except Release.DoesNotExist:
            # Future release doesn't exist yet, return None and the version string
            return None, value
