from __future__ import annotations

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.models.project import Project
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.utils import (
    deduplicate_repositories,
    get_autofix_repos_from_project_code_mappings,
    read_preference_from_sentry_db,
    write_preference_to_sentry_db,
)
from sentry.seer.endpoints.organization_autofix_automation_settings import (
    RepositorySerializer as BaseRepositorySerializer,
)
from sentry.seer.models import PreferenceResponse, SeerProjectPreference
from sentry.seer.utils import filter_repo_by_provider
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class RepositorySerializer(BaseRepositorySerializer):
    organization_id = serializers.IntegerField(required=True)
    integration_id = serializers.CharField(required=True)


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

    def validate_repositories(self, value):
        return deduplicate_repositories(value)


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
        write_preference_to_sentry_db(project, preference)

        return Response(status=204)

    def get(self, request: Request, project: Project) -> Response:
        preference = read_preference_from_sentry_db(project)

        code_mapping_repos = get_autofix_repos_from_project_code_mappings(project)

        return Response(
            PreferenceResponse(
                preference=preference,
                code_mapping_repos=code_mapping_repos,
            ).dict()
        )
