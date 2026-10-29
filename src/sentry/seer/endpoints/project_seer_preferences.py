from __future__ import annotations

import sentry_sdk
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.utils import (
    get_autofix_repos_from_project_code_mappings,
    get_repo_url_path,
    read_preference_from_sentry_db,
    write_preference_to_sentry_db,
)
from sentry.seer.models import PreferenceResponse, SeerProjectPreference
from sentry.seer.seer_setup import get_supported_scm_providers
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class BranchOverrideSerializer(CamelSnakeSerializer):
    tag_name = serializers.CharField(required=True)
    tag_value = serializers.CharField(required=True)
    branch_name = serializers.CharField(required=True)


@extend_schema_serializer(deprecate_fields=["owner", "name"])
class RepositorySerializer(CamelSnakeSerializer):
    repository_id = serializers.IntegerField(required=False)
    provider = serializers.CharField(required=False)
    owner = serializers.CharField(required=False)
    name = serializers.CharField(required=False)
    external_id = serializers.CharField(required=False)
    organization_id = serializers.IntegerField(required=False)
    integration_id = serializers.CharField(required=False)
    branch_name = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    branch_overrides = BranchOverrideSerializer(
        many=True, required=False, default=list, allow_null=False
    )
    instructions = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    base_commit_sha = serializers.CharField(required=False, allow_null=True)
    provider_raw = serializers.CharField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("repository_id") is not None:
            return attrs

        legacy_identity_fields = (
            "provider",
            "owner",
            "name",
            "external_id",
            "organization_id",
            "integration_id",
        )
        missing_fields = [field for field in legacy_identity_fields if field not in attrs]
        if missing_fields:
            raise serializers.ValidationError(
                {field: "This field is required." for field in missing_fields}
            )

        supported = get_supported_scm_providers(self.context.get("organization"))
        if attrs["provider"] not in supported:
            supported_str = ", ".join(sorted(supported))
            raise serializers.ValidationError(
                {
                    "provider": (
                        f'"{attrs["provider"]}" is not a supported Seer provider. '
                        f"Supported providers: {supported_str}"
                    )
                }
            )
        return attrs

    def validate_branch_overrides(self, value):
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
        "POST": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
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
        serializer = ProjectSeerPreferencesSerializer(
            data=request.data,
            context={"organization": project.organization},
        )
        serializer.is_valid(raise_exception=True)

        resolved_repositories = []
        seen_repository_ids = set()
        for repo_data in serializer.validated_data.get("repositories", []):
            repository_id = repo_data.get("repository_id")
            provider = repo_data.get("provider")
            external_id = repo_data.get("external_id")
            repo_org_id = repo_data.get("organization_id")
            owner = repo_data.get("owner")
            name = repo_data.get("name")
            repo_name = f"{owner}/{name}" if owner is not None and name is not None else None

            if repo_org_id is not None and repo_org_id != project.organization.id:
                return Response({"detail": "Invalid repository"}, status=400)

            repo_data["organization_id"] = project.organization.id

            repo, _resolution = Repository.objects.resolve_active_by_reference(
                organization_id=project.organization.id,
                repository_id=repository_id,
                provider=provider,
                external_id=external_id,
                name=repo_name,
            )
            if (
                repo is None
                or repo.provider not in get_supported_scm_providers(project.organization)
                or not repo.external_id
            ):
                return Response({"detail": "Invalid repository"}, status=400)

            if repo.id in seen_repository_ids:
                continue
            seen_repository_ids.add(repo.id)

            try:
                repo_path_parts = get_repo_url_path(repo).split("/", 1)
            except ValueError as error:
                sentry_sdk.capture_exception(error)
                return Response({"detail": "Invalid repository"}, status=400)
            if len(repo_path_parts) != 2:
                return Response({"detail": "Invalid repository"}, status=400)

            repo_data.update(
                {
                    "repository_id": repo.id,
                    "organization_id": repo.organization_id,
                    "integration_id": (
                        str(repo.integration_id) if repo.integration_id is not None else None
                    ),
                    "provider": repo.provider,
                    "owner": repo_path_parts[0],
                    "name": repo_path_parts[1],
                    "external_id": repo.external_id,
                }
            )
            resolved_repositories.append(repo_data)

        serializer.validated_data["repositories"] = resolved_repositories

        preference = SeerProjectPreference.validate(
            {
                **serializer.validated_data,
                "organization_id": project.organization.id,
                "project_id": project.id,
            }
        )
        write_preference_to_sentry_db(preference)

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
