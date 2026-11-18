from typing import Annotated, NotRequired, TypedDict

from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from sentry.api.helpers.group_index.validators.in_commit import InCommitResult, InCommitValidator
from sentry.apidocs.descriptions import ApiDescription
from sentry.models.release import Release


class StatusDetailsResult(TypedDict):
    inNextRelease: NotRequired[
        Annotated[bool, ApiDescription("Whether the issues are resolved in the next release")]
    ]
    inRelease: NotRequired[
        Annotated[str, ApiDescription("Version of the release the issues are resolved in")]
    ]
    inCommit: NotRequired[
        Annotated[InCommitResult, ApiDescription("Commit that resolves the issues")]
    ]
    ignoreDuration: NotRequired[
        Annotated[int, ApiDescription("Minutes the issues are ignored for")]
    ]
    ignoreCount: NotRequired[
        Annotated[
            int,
            ApiDescription(
                "Number of occurrences, within ignoreWindow minutes, after which the issues stop being ignored"
            ),
        ]
    ]
    ignoreWindow: NotRequired[Annotated[int, ApiDescription("Window in minutes for ignoreCount")]]
    ignoreUserCount: NotRequired[
        Annotated[
            int,
            ApiDescription(
                "Number of affected users, within ignoreUserWindow minutes, after which the issues stop being ignored"
            ),
        ]
    ]
    ignoreUserWindow: NotRequired[
        Annotated[int, ApiDescription("Window in minutes for ignoreUserCount")]
    ]


@extend_schema_serializer()
class StatusDetailsValidator(serializers.Serializer[StatusDetailsResult]):
    inNextRelease = serializers.BooleanField(
        required=False, help_text="If true, marks the issue as resolved in the next release."
    )
    inRelease = serializers.CharField(
        required=False,
        help_text=(
            "The version of the release that the issue should be resolved in."
            "If set to `latest`, the latest release will be used."
        ),
    )
    inCommit = InCommitValidator(
        help_text="The commit data that the issue should use for resolution.", required=False
    )
    ignoreDuration = serializers.IntegerField(
        required=False, help_text="Ignore the issue until for this many minutes.", min_value=0
    )
    ignoreCount = serializers.IntegerField(
        required=False,
        help_text="Ignore the issue until it has occurred this many times in `ignoreWindow` minutes.",
        min_value=0,
    )
    ignoreWindow = serializers.IntegerField(
        required=False,
        help_text="Ignore the issue until it has occurred `ignoreCount` times in this many minutes. (Max: 1 week)",
        min_value=0,
        max_value=7 * 24 * 60,
    )
    ignoreUserCount = serializers.IntegerField(
        required=False,
        help_text="Ignore the issue until it has affected this many users in `ignoreUserWindow` minutes.",
        min_value=0,
    )
    ignoreUserWindow = serializers.IntegerField(
        required=False,
        help_text="Ignore the issue until it has affected `ignoreUserCount` users in this many minutes. (Max: 1 week)",
        min_value=0,
        max_value=7 * 24 * 60,
    )

    def validate_inRelease(self, value: str) -> Release:
        project = self.context["project"]
        if value == "latest":
            try:
                release = (
                    Release.objects.filter(
                        projects=project, organization_id=project.organization_id
                    )
                    .extra(select={"sort": "COALESCE(date_released, date_added)"})
                    .order_by("-sort")[0]
                )
                return release
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
            release = (
                Release.objects.filter(projects=project, organization_id=project.organization_id)
                .extra(select={"sort": "COALESCE(date_released, date_added)"})
                .order_by("-sort")[0]
            )
            return release
        except IndexError:
            raise serializers.ValidationError(
                "No release data present in the system to form a basis for 'Next Release'"
            )
