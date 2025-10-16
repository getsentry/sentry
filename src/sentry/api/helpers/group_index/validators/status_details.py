from typing import Any, NotRequired, TypedDict

from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from sentry import features
from sentry.api.helpers.group_index.validators.in_commit import InCommitResult, InCommitValidator
from sentry.models.release import Release


class StatusDetailsResult(TypedDict):
    inFutureRelease: NotRequired[bool]
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
        help_text=(
            "The version of the semver release that the issue should be resolved in."
            "This release can be a future release that doesn't exist yet."
        )
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

    def validate_inFutureRelease(self, value: str) -> "Release | None":
        project = self.context["project"]

        if not features.has("organizations:resolve-in-future-release", project.organization):
            raise serializers.ValidationError(
                "Your organization does not have access to this feature."
            )

        if not Release.is_valid_version(value):
            raise serializers.ValidationError(
                "Invalid release version format. Please use semver format: package@major.minor.patch[-prerelease][+build]."
            )

        if not Release.is_semver_version(value):
            raise serializers.ValidationError(
                "Invalid semver format. Please use format: package@major.minor.patch[-prerelease][+build]"
            )

        try:
            release = Release.objects.get(
                projects=project, organization_id=project.organization_id, version=value
            )
            return release
        except Release.DoesNotExist:
            return None

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        """
        Cross-field validation hook called by DRF after individual field validation.
        """
        return self._preserve_future_release_version(attrs)

    def _preserve_future_release_version(self, attrs: dict[str, Any]) -> dict[str, Any]:
        """
        Store the original future release version string for inFutureRelease since the validator
        transforms it to a Release object or None, but we need the version string for
        process_group_resolution.
        """
        if "inFutureRelease" in attrs:
            initial_data = getattr(self, "initial_data", {})
            future_release_version = initial_data.get("inFutureRelease")
            if future_release_version:
                attrs["_future_release_version"] = future_release_version
        return attrs
