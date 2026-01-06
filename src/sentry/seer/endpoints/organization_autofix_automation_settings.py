from __future__ import annotations

from typing import Any

from django.db import router, transaction
from django.db.models import Q
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    SeerAutofixSettingsSerializer,
    bulk_get_project_preferences,
    bulk_set_project_preferences,
    default_seer_project_preference,
)
from sentry.seer.endpoints.project_seer_preferences import BranchOverrideSerializer
from sentry.seer.models import SeerRepoDefinition


def merge_repositories(existing: list[dict], new: list[dict]) -> list[dict]:
    """
    Merge new repositories with existing ones, skipping duplicates by (org_id, provider, external_id).
    """
    _unique_repo_key = lambda r: (r.get("organization_id"), r.get("provider"), r.get("external_id"))

    existing_keys = {_unique_repo_key(repo) for repo in existing}
    merged = list(existing)
    for repo in new:
        if _unique_repo_key(repo) not in existing_keys:
            merged.append(repo)
            existing_keys.add(_unique_repo_key(repo))
    return merged


class RepositorySerializer(CamelSnakeSerializer):
    provider = serializers.CharField(required=True)
    owner = serializers.CharField(required=False)
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

    def validate(self, data):
        if not data.get("owner"):
            if "/" not in data["name"]:
                raise serializers.ValidationError(
                    "Either 'owner' must be provided, or 'name' must be in 'owner/repo' format"
                )
            parts = data["name"].split("/", 2)
            if len(parts) != 2:
                raise serializers.ValidationError(
                    "Invalid repository name. Must be in 'owner/repo' format"
                )
            data["owner"] = parts[0]
            data["name"] = parts[1]

        return data


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


class SeerAutofixSettingGetResponseSerializer(serializers.Serializer):
    """Serializer for OrganizationAutofixAutomationSettingsEndpoint.get query params"""

    query = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Optional search query to filter by project name or slug.",
    )


class SeerAutofixSettingsPostSerializer(SeerAutofixSettingsSerializer):
    """Serializer for OrganizationAutofixAutomationSettingsEndpoint.post"""

    projectIds = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        min_length=1,
        max_length=1000,
        help_text="List of project IDs to create/update settings for.",
    )
    projectRepoMappings = ProjectRepoMappingField(
        required=False,
        allow_null=True,
        help_text="Optional mapping of project IDs to repository configurations. If provided, updates the repository list for each specified project.",
    )
    appendRepositories = serializers.BooleanField(
        required=False,
        default=False,
        help_text="If true, appends repositories to existing list instead of overwriting. Duplicates (by organization_id, provider, external_id) are skipped.",
    )

    def validate(self, data):
        if (
            "autofixAutomationTuning" not in data
            and "automatedRunStoppingPoint" not in data
            and "projectRepoMappings" not in data
        ):
            raise serializers.ValidationError(
                "At least one of 'autofixAutomationTuning', 'automatedRunStoppingPoint', or 'projectRepoMappings' must be provided."
            )
        return data


@region_silo_endpoint
class OrganizationAutofixAutomationSettingsEndpoint(OrganizationEndpoint):
    """Bulk endpoint for managing project level autofix automation settings."""

    owner = ApiOwner.CODING_WORKFLOWS

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (OrganizationPermission,)

    def _serialize_projects_with_settings(
        self, projects: list[Project], organization: Organization
    ) -> list[dict]:
        if not projects:
            return []

        project_ids_list = [project.id for project in projects]
        autofix_automation_tuning_map = ProjectOption.objects.get_value_bulk(
            projects, "sentry:autofix_automation_tuning"
        )
        seer_preferences_map = bulk_get_project_preferences(organization.id, project_ids_list) or {}
        results = []
        for project in projects:
            autofix_automation_tuning = (
                autofix_automation_tuning_map.get(project)
                or AutofixAutomationTuningSettings.OFF.value
            )
            seer_pref = seer_preferences_map.get(str(project.id)) or {}
            automated_run_stopping_point = seer_pref.get(
                "automated_run_stopping_point", AutofixStoppingPoint.CODE_CHANGES.value
            )
            repos_count = len(seer_pref.get("repositories") or [])

            results.append(
                {
                    "projectId": project.id,
                    "autofixAutomationTuning": autofix_automation_tuning,
                    "automatedRunStoppingPoint": automated_run_stopping_point,
                    "reposCount": repos_count,
                }
            )
        return results

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List projects with their autofix automation settings.

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :qparam string query: Optional search query to filter by project name or slug.
        :auth: required
        """
        serializer = SeerAutofixSettingGetResponseSerializer(
            data={
                "query": request.GET.get("query"),
            }
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        queryset = Project.objects.filter(organization_id=organization.id)

        query = serializer.validated_data.get("query")
        if query:
            queryset = queryset.filter(Q(name__icontains=query) | Q(slug__icontains=query))

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="slug",
            on_results=lambda projects: self._serialize_projects_with_settings(
                projects, organization
            ),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Bulk create/update the autofix automation settings of projects in a single request.

        NOTE: When ProjectRepoMappings are provided, it will overwrite existing repositories by default.
        Set appendRepositories=true to append instead (duplicates by organization_id, provider, external_id are skipped).

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :auth: required
        """
        serializer = SeerAutofixSettingsPostSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        project_ids = set[int](serializer.validated_data["projectIds"] or [])
        autofix_automation_tuning = serializer.validated_data.get("autofixAutomationTuning")
        automated_run_stopping_point = serializer.validated_data.get("automatedRunStoppingPoint")
        project_repo_mappings = serializer.validated_data.get("projectRepoMappings")
        append_repositories = serializer.validated_data.get("appendRepositories")

        projects = self.get_projects(request, organization, project_ids=project_ids)
        projects_by_id = {project.id: project for project in projects}

        # Filter projectRepoMappings to only include validated project IDs
        filtered_repo_mappings: dict[int, list] = {}
        if project_repo_mappings:
            filtered_repo_mappings = {
                proj_id: repos
                for proj_id, repos in project_repo_mappings.items()
                if proj_id in projects_by_id
            }

        preferences_to_set: list[dict[str, Any]] = []

        if automated_run_stopping_point or filtered_repo_mappings:
            existing_preferences = bulk_get_project_preferences(
                organization.id, list(projects_by_id.keys())
            )

            for proj_id, project in projects_by_id.items():
                has_stopping_point_update = automated_run_stopping_point is not None
                has_repo_update = proj_id in filtered_repo_mappings

                if not has_stopping_point_update and not has_repo_update:
                    continue

                project_id_str = str(proj_id)
                existing_pref = existing_preferences.get(project_id_str, {})

                pref_update: dict[str, Any] = {
                    **default_seer_project_preference(project).dict(),
                    **existing_pref,
                    "organization_id": organization.id,
                    "project_id": proj_id,
                }

                if has_stopping_point_update:
                    pref_update["automated_run_stopping_point"] = automated_run_stopping_point

                if has_repo_update:
                    repos_data = filtered_repo_mappings[proj_id]
                    new_repos = [SeerRepoDefinition(**repo_data).dict() for repo_data in repos_data]
                    if append_repositories:
                        existing_repos = existing_pref.get("repositories") or []
                        pref_update["repositories"] = merge_repositories(existing_repos, new_repos)
                    else:
                        pref_update["repositories"] = new_repos

                preferences_to_set.append(pref_update)

        # Wrap DB writes and Seer API call in a transaction.
        # If Seer API fails, DB changes are rolled back.
        with transaction.atomic(router.db_for_write(ProjectOption)):
            if autofix_automation_tuning:
                for project in projects:
                    project.update_option(
                        "sentry:autofix_automation_tuning", autofix_automation_tuning
                    )

            if preferences_to_set:
                bulk_set_project_preferences(organization.id, preferences_to_set)

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=organization.id,
            event=audit_log.get_event_id("AUTOFIX_SETTINGS_EDIT"),
            data={
                "project_count": len(projects),
                "project_ids": list(project_ids),
                "autofix_automation_tuning": autofix_automation_tuning,
                "automated_run_stopping_point": automated_run_stopping_point,
            },
        )

        return Response(status=204)
