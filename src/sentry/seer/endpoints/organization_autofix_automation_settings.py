from __future__ import annotations

from django.db import router, transaction
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    bulk_get_project_preferences,
    bulk_set_project_preferences,
)

OPTION_KEY = "sentry:autofix_automation_tuning"


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
        "PUT": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (OrganizationPermission,)

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
