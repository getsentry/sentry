from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.repository import RepositorySerializer
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewTrigger, RepositorySettings


def _get_enabled_code_review_value(
    updated_value: bool | None, existing_setting: RepositorySettings | None
) -> bool:
    if updated_value is not None:
        return updated_value
    if existing_setting:
        return existing_setting.enabled_code_review
    return False


def _get_code_review_triggers_value(
    updated_value: list[str] | None, existing_setting: RepositorySettings | None
) -> list[str]:
    if updated_value is not None:
        return updated_value
    if existing_setting:
        return existing_setting.code_review_triggers
    return []


class RepositorySettingsSerializer(serializers.Serializer):
    repositoryIds = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        max_length=1000,
        help_text="List of repository IDs to update settings for. Maximum 1000 repositories.",
    )
    enabledCodeReview = serializers.BooleanField(
        required=False,
        help_text="Whether code review is enabled for these repositories",
    )
    codeReviewTriggers = serializers.ListField(
        child=serializers.ChoiceField(choices=[trigger.value for trigger in CodeReviewTrigger]),
        required=False,
        help_text="List of triggers for code review",
    )

    def validate(self, data):
        if "enabledCodeReview" not in data and "codeReviewTriggers" not in data:
            raise serializers.ValidationError(
                "At least one of 'enabledCodeReview' or 'codeReviewTriggers' must be provided."
            )
        return data


@region_silo_endpoint
class OrganizationRepositorySettingsEndpoint(OrganizationEndpoint):
    """Bulk endpoint for managing repository settings."""

    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationIntegrationsPermission,)

    def put(self, request: Request, organization: Organization) -> Response:
        """
        Create or update repository settings for multiple repositories. Currently this is strictly built for the seer specific
        settings, so if you want to use this for other settings, you will need to update the serializer and business logic below accordingly.

        :pparam string organization_id_or_slug: the id or slug of the organization
        :auth: required
        """
        serializer = RepositorySettingsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        repository_ids = data["repositoryIds"]

        updated_enabled_code_review = data.get("enabledCodeReview")
        updated_code_review_triggers = data.get("codeReviewTriggers")

        update_fields = []
        if updated_enabled_code_review is not None:
            update_fields.append("enabled_code_review")
        if updated_code_review_triggers is not None:
            update_fields.append("code_review_triggers")

        repositories = Repository.objects.filter(
            id__in=repository_ids,
            organization_id=organization.id,
        )

        if repositories.count() != len(repository_ids):
            return Response(
                {"detail": "One or more repositories were not found in this organization."},
                status=400,
            )

        existing_settings = {
            setting.repository_id: setting
            for setting in RepositorySettings.objects.filter(repository_id__in=repository_ids)
        }

        settings_to_upsert = []
        for repo in repositories:
            existing_setting = existing_settings.get(repo.id)
            settings_to_upsert.append(
                RepositorySettings(
                    repository=repo,
                    enabled_code_review=_get_enabled_code_review_value(
                        updated_enabled_code_review, existing_setting
                    ),
                    code_review_triggers=_get_code_review_triggers_value(
                        updated_code_review_triggers, existing_setting
                    ),
                )
            )

        RepositorySettings.objects.bulk_create(
            settings_to_upsert,
            update_conflicts=True,
            unique_fields=["repository"],
            update_fields=update_fields,
        )

        return Response(
            serialize(
                list(repositories),
                request.user,
                RepositorySerializer(expand=["settings"]),
            ),
            status=200,
        )
