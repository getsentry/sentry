from __future__ import annotations

import logging

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.models.project import Project
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.utils import (
    GetProjectPreferenceRequest,
    SetProjectPreferenceRequest,
    get_autofix_repos_from_project_code_mappings,
    make_get_project_preference_request,
    make_set_project_preference_request,
    write_preference_to_sentry_db,
)
from sentry.seer.models import PreferenceResponse, SeerApiError, SeerProjectPreference
from sentry.seer.signed_seer_api import SeerViewerContext, seer_autofix_default_connection_pool
from sentry.seer.utils import filter_repo_by_provider
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


class BranchOverrideSerializer(CamelSnakeSerializer):
    tag_name = serializers.CharField(required=True)
    tag_value = serializers.CharField(required=True)
    branch_name = serializers.CharField(required=True)


def validate_unique_branch_overrides(value):
    if not value:
        return value

    seen = set()
    for override in value:
        key = (override["tag_name"], override["tag_value"])
        if key in seen:
            raise serializers.ValidationError(
                f"Duplicate branch override for tag {key[0]}={key[1]}"
            )
        seen.add(key)
    return value


class RepositorySerializer(CamelSnakeSerializer):
    organization_id = serializers.IntegerField(required=True)
    integration_id = serializers.CharField(required=True)
    provider = serializers.CharField(required=True)
    owner = serializers.CharField(required=True)
    name = serializers.CharField(required=True)
    external_id = serializers.CharField(required=True)
    branch_name = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    branch_overrides = BranchOverrideSerializer(
        many=True,
        required=False,
        allow_null=True,
    )
    instructions = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    base_commit_sha = serializers.CharField(required=False, allow_null=True)
    provider_raw = serializers.CharField(required=False, allow_null=True)

    def validate_branch_overrides(self, value):
        return validate_unique_branch_overrides(value)


class SeerAutomationHandoffConfigurationSerializer(CamelSnakeSerializer):
    handoff_point = serializers.ChoiceField(
        choices=["root_cause"],
        required=True,
    )
    target = serializers.ChoiceField(
        choices=["cursor_background_agent", "claude_code_agent"],
        required=True,
    )
    integration_id = serializers.IntegerField(required=True)
    auto_create_pr = serializers.BooleanField(required=False, default=False)


class ProjectSeerPreferencesSerializer(CamelSnakeSerializer):
    repositories = RepositorySerializer(many=True, required=True)
    automated_run_stopping_point = serializers.CharField(required=False, allow_null=True)
    automation_handoff = SeerAutomationHandoffConfigurationSerializer(
        required=False, allow_null=True
    )


@cell_silo_endpoint
class ProjectSeerPreferencesEndpoint(ProjectEndpoint):
    permission_classes = (
        ProjectEventPermission,  # Anyone in the org should be able to set preferences, follows event permissions.
    )
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=20, window=60),
                RateLimitCategory.USER: RateLimit(limit=20, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=60, window=60),
            },
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=1000, window=60, concurrent_limit=500),
                RateLimitCategory.USER: RateLimit(limit=1000, window=60, concurrent_limit=500),
                RateLimitCategory.ORGANIZATION: RateLimit(
                    limit=5000, window=60, concurrent_limit=1000
                ),
            },
            "OPTIONS": {
                RateLimitCategory.IP: RateLimit(limit=1000, window=60, concurrent_limit=500),
                RateLimitCategory.USER: RateLimit(limit=1000, window=60, concurrent_limit=500),
                RateLimitCategory.ORGANIZATION: RateLimit(
                    limit=5000, window=60, concurrent_limit=1000
                ),
            },
        }
    )

    def post(self, request: Request, project: Project) -> Response:
        serializer = ProjectSeerPreferencesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for repo_data in serializer.validated_data.get("repositories", []):
            provider = repo_data.get("provider")
            external_id = repo_data.get("external_id")
            repo_org_id = repo_data.get("organization_id")
            owner = repo_data.get("owner")
            name = repo_data.get("name")

            if repo_org_id is not None and repo_org_id != project.organization.id:
                return Response({"detail": "Invalid repository"}, status=400)

            repo_data["organization_id"] = project.organization.id

            repo = filter_repo_by_provider(
                project.organization.id, provider, external_id, owner, name
            ).first()
            if repo is None:
                return Response({"detail": "Invalid repository"}, status=400)
            repo_data["repository_id"] = repo.id

        preference = SeerProjectPreference.validate(
            {
                **serializer.validated_data,
                "organization_id": project.organization.id,
                "project_id": project.id,
            }
        )
        viewer_context = SeerViewerContext(
            organization_id=project.organization.id, user_id=request.user.id
        )
        response = make_set_project_preference_request(
            SetProjectPreferenceRequest(preference=preference.dict()),
            connection_pool=seer_autofix_default_connection_pool,
            viewer_context=viewer_context,
        )

        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)

        if features.has("organizations:seer-project-settings-dual-write", project.organization):
            try:
                write_preference_to_sentry_db(project, preference)
            except Exception:
                logger.exception(
                    "seer.write_preferences.failed",
                    extra={"project_id": project.id, "organization_id": project.organization.id},
                )

        return Response(status=204)

    def get(self, request: Request, project: Project) -> Response:
        body = GetProjectPreferenceRequest(project_id=project.id)
        viewer_context = SeerViewerContext(
            organization_id=project.organization.id, user_id=request.user.id
        )
        response = make_get_project_preference_request(
            body,
            connection_pool=seer_autofix_default_connection_pool,
            viewer_context=viewer_context,
        )

        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)

        result = response.json()

        code_mapping_repos = get_autofix_repos_from_project_code_mappings(project)

        return Response(
            PreferenceResponse.validate(
                {
                    **result,
                    "code_mapping_repos": code_mapping_repos,
                }
            ).dict()
        )
