from rest_framework import serializers

from sentry import features
from sentry.models.release import Release

from . import InCommitValidator


class StatusDetailsValidator(serializers.Serializer):
    inNextRelease = serializers.BooleanField()
    inUpcomingRelease = serializers.BooleanField()
    inRelease = serializers.CharField()
    inCommit = InCommitValidator(required=False)
    ignoreDuration = serializers.IntegerField()
    ignoreCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    ignoreUserCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreUserWindow = serializers.IntegerField(max_value=7 * 24 * 60)

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

    def validate_inUpcomingRelease(self, value: bool) -> "Release":
        project = self.context["project"]

        if not features.has("organizations:resolve-in-upcoming-release", project.organization):
            raise serializers.ValidationError(
                "Your organization does not have access to this feature."
            )

        try:
            return (
                Release.objects.filter(projects=project, organization_id=project.organization_id)
                .extra(select={"sort": "COALESCE(date_released, date_added)"})
                .order_by("-sort")[0]
            )
        except IndexError:
            raise serializers.ValidationError("No release data present in the system.")
