from __future__ import annotations

from typing import Any

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
    SeerAutofixSettingsSerializer,
    bulk_get_project_preferences,
    bulk_set_project_preferences,
    default_seer_project_preference,
)


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
        :qparam list[int] projectIds: Optional list of project IDs to filter by.
        :qparam string query: Optional search query to filter by project name or slug.
        :auth: required
        """
        serializer = SeerAutofixSettingGetResponseSerializer(
            data={
                "projectIds": request.GET.getlist("projectIds") or None,
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

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :auth: required
        """
        serializer = SeerAutofixSettingsPostSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        project_ids = set[int](serializer.validated_data["projectIds"] or [])
        autofix_automation_tuning = serializer.validated_data.get("autofixAutomationTuning")
        automated_run_stopping_point = serializer.validated_data.get("automatedRunStoppingPoint")

        projects = self.get_projects(request, organization, project_ids=project_ids)

        preferences_to_set: list[dict[str, Any]] = []
        if automated_run_stopping_point:
            project_ids_list = [project.id for project in projects]
            existing_preferences = bulk_get_project_preferences(organization.id, project_ids_list)

            for project in projects:
                project_id_str = str(project.id)
                existing_pref = existing_preferences.get(project_id_str, {})

                preferences_to_set.append(
                    {
                        **default_seer_project_preference(project).dict(),
                        **existing_pref,
                        "organization_id": organization.id,
                        "project_id": project.id,
                        "automated_run_stopping_point": automated_run_stopping_point,
                    }
                )

        # Wrap DB writes and Seer API call in a transaction.
        # If Seer API fails, DB changes are rolled back.
        with transaction.atomic(router.db_for_write(ProjectOption)):
            if autofix_automation_tuning:
                autofix_automation_tuning_value = (
                    autofix_automation_tuning or AutofixAutomationTuningSettings.OFF.value
                )
                for project in projects:
                    project.update_option(
                        "sentry:autofix_automation_tuning", autofix_automation_tuning_value
                    )

            if preferences_to_set:
                bulk_set_project_preferences(organization.id, preferences_to_set)

        return Response(status=204)
