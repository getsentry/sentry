from __future__ import annotations

import logging

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.models.organization import Organization
from sentry.seer.autofix.autofix import onboarding_seer_settings_update
from sentry.seer.endpoints.project_seer_preferences import BranchOverrideSerializer
from sentry.seer.models import SeerRepoDefinition

logger = logging.getLogger(__name__)


class RepositorySerializer(CamelSnakeSerializer):
    provider = serializers.CharField(required=True)
    owner = serializers.CharField(required=True)
    name = serializers.CharField(required=True)
    external_id = serializers.CharField(required=True)
    organization_id = serializers.IntegerField(required=False, allow_null=True)
    integration_id = serializers.CharField(required=False, allow_null=True)
    branch_name = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    branch_overrides = BranchOverrideSerializer(
        many=True, required=False, default=list, allow_null=False
    )
    instructions = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    base_commit_sha = serializers.CharField(required=False, allow_null=True)
    provider_raw = serializers.CharField(required=False, allow_null=True)


class ProjectRepoMappingField(serializers.Field):
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError("Expected a dictionary")

        result = {}
        for project_id_str, repos_data in data.items():
            try:
                project_id = int(project_id_str)
                if project_id <= 0:
                    raise ValueError
            except (ValueError, TypeError):
                raise serializers.ValidationError(
                    f"Invalid project ID: {project_id_str}. Must be a positive integer."
                )

            if not isinstance(repos_data, list):
                raise serializers.ValidationError(
                    f"Expected a list of repositories for project {project_id_str}"
                )

            serialized_repos = []
            for repo_data in repos_data:
                repo_serializer = RepositorySerializer(data=repo_data)
                if not repo_serializer.is_valid():
                    raise serializers.ValidationError(
                        {f"project_{project_id_str}": repo_serializer.errors}
                    )
                serialized_repos.append(repo_serializer.validated_data)

            result[project_id] = serialized_repos

        return result


class AutofixConfigSerializer(CamelSnakeSerializer):
    fixes = serializers.BooleanField(required=True)
    pr_creation = serializers.BooleanField(required=True)
    project_repo_mapping = ProjectRepoMappingField(required=True)

    def validate(self, data):
        # If fixes is disabled, pr_creation must also be disabled
        if not data.get("fixes") and data.get("pr_creation"):
            raise serializers.ValidationError(
                {"pr_creation": "PR creation cannot be enabled when fixes is disabled."}
            )
        return data


class SeerOnboardingSerializer(CamelSnakeSerializer):
    autofix = AutofixConfigSerializer(required=True)


@region_silo_endpoint
class OrganizationSeerOnboardingEndpoint(OrganizationEndpoint):
    """Endpoint for configuring Seer settings during organization onboarding."""

    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationPermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        serializer = SeerOnboardingSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        autofix_config = data["autofix"]

        is_rca_enabled = autofix_config["fixes"]
        is_auto_open_prs_enabled = autofix_config["pr_creation"]
        project_repo_mapping = autofix_config["project_repo_mapping"]

        # This will raise if any of the projects belong to another organization.
        self.get_projects(request, organization, project_ids=set(project_repo_mapping.keys()))

        project_repo_dict: dict[int, list[SeerRepoDefinition]] = {}
        for project_id, repos_data in project_repo_mapping.items():
            project_repo_dict[project_id] = [
                SeerRepoDefinition(**repo_data) for repo_data in repos_data
            ]

        onboarding_seer_settings_update(
            organization_id=organization.id,
            is_rca_enabled=is_rca_enabled,
            is_auto_open_prs_enabled=is_auto_open_prs_enabled,
            project_repo_dict=project_repo_dict,
        )
        return Response(status=204)
