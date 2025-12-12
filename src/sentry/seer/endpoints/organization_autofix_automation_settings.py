from __future__ import annotations

from django.db import router, transaction
from django.db.models import Q
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    bulk_get_project_preferences,
    bulk_set_project_preferences,
)

OPTION_KEY = "sentry:autofix_automation_tuning"


class SeerAutofixSettingGetSerializer(serializers.Serializer):
    """Serializer for OrganizationAutofixAutomationSettingsEndpoint.get query params"""

    projectIds = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_null=True,
        max_length=1000,
        help_text="Optional list of project IDs to filter by. Maximum 1000 projects.",
    )
    query = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Optional search query to filter by project name or slug.",
    )


class SeerAutofixSettingSerializer(serializers.Serializer):
    """Serializer for OrganizationAutofixAutomationSettingsEndpoint.put"""

    projectIds = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        min_length=1,
        max_length=1000,
        help_text="List of project IDs to update settings for.",
    )
    fixes = serializers.BooleanField(
        required=True,
        help_text="Whether to enable fixes for the projects.",
    )
    pr_creation = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Whether to enable PR creation for the projects. Requires fixes to be enabled.",
    )

    def validate(self, data):
        # If fixes is disabled, pr_creation must also be disabled
        if not data.get("fixes") and data.get("pr_creation"):
            raise serializers.ValidationError(
                {"pr_creation": "PR creation cannot be enabled when fixes is disabled."}
            )
        return data


@region_silo_endpoint
class OrganizationAutofixAutomationSettingsEndpoint(OrganizationEndpoint):
    """Bulk endpoint for managing project level autofix automation settings."""

    owner = ApiOwner.CODING_WORKFLOWS

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (OrganizationPermission,)

    def _serialize_projects_with_settings(
        self, projects: list[Project], organization: Organization
    ) -> list[dict]:
        if not projects:
            return []

        project_ids_list = [project.id for project in projects]
        tuning_options = ProjectOption.objects.get_value_bulk(projects, OPTION_KEY)
        seer_preferences = bulk_get_project_preferences(organization.id, project_ids_list)

        results = []
        for project in projects:
            tuning_value = tuning_options.get(project) or AutofixAutomationTuningSettings.OFF.value
            seer_pref = seer_preferences.get(str(project.id), {})

            results.append(
                {
                    "projectId": project.id,
                    "projectSlug": project.slug,
                    "projectName": project.name,
                    "projectPlatform": project.platform,
                    "fixes": tuning_value != AutofixAutomationTuningSettings.OFF.value,
                    "prCreation": seer_pref.get("automated_run_stopping_point")
                    == AutofixStoppingPoint.OPEN_PR.value,
                    "tuning": tuning_value,
                    "reposCount": len(seer_pref.get("repositories", [])),
                }
            )
        return results

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List projects with their autofix automation settings.

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :qparam list[int] projectIds: Optional list of project IDs to filter by.
        :qparam string query: Optional search query to filter by project name or slug.
        :auth: required
        """
        serializer = SeerAutofixSettingGetSerializer(
            data={
                "projectIds": request.GET.getlist("projectIds") or None,
                "query": request.GET.get("query"),
            }
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        project_ids = data.get("projectIds")

        if project_ids:
            authorized_projects = self.get_projects(
                request, organization, project_ids=set(project_ids)
            )
            authorized_project_ids = [p.id for p in authorized_projects]
            queryset = Project.objects.filter(id__in=authorized_project_ids)
        else:
            queryset = Project.objects.filter(organization_id=organization.id)

        query = data.get("query")
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

    def put(self, request: Request, organization: Organization) -> Response:
        """
        Bulk update the autofix automation settings of projects in a single request.

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :auth: required
        """
        serializer = SeerAutofixSettingSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        project_ids = set(data["projectIds"])
        fixes_enabled = data["fixes"]
        pr_creation_enabled = data.get("pr_creation", False)

        projects = self.get_projects(request, organization, project_ids=project_ids)

        tuning_setting = (
            AutofixAutomationTuningSettings.MEDIUM
            if fixes_enabled
            else AutofixAutomationTuningSettings.OFF
        )

        stopping_point = (
            AutofixStoppingPoint.OPEN_PR
            if pr_creation_enabled
            else AutofixStoppingPoint.CODE_CHANGES
        )

        project_ids_list = [project.id for project in projects]
        existing_preferences = bulk_get_project_preferences(organization.id, project_ids_list)

        preferences_to_set = []
        for project in projects:
            project_id_str = str(project.id)
            existing_pref = existing_preferences.get(project_id_str, {})

            preferences_to_set.append(
                {
                    **existing_pref,
                    "organization_id": organization.id,
                    "project_id": project.id,
                    "automated_run_stopping_point": stopping_point.value,
                }
            )

        # Wrap DB writes and Seer API call in a transaction.
        # If Seer API fails, DB changes are rolled back.
        with transaction.atomic(router.db_for_write(ProjectOption)):
            for project in projects:
                project.update_option(OPTION_KEY, tuning_setting.value)

            if preferences_to_set:
                bulk_set_project_preferences(organization.id, preferences_to_set)

        return Response(status=204)
