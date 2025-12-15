from __future__ import annotations

from typing import Any

from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    SeerAutofixSettingsSerializer,
    bulk_set_project_preferences,
    get_project_seer_preferences,
)


@region_silo_endpoint
class ProjectAutofixAutomationSettingsEndpoint(ProjectEndpoint):
    """Bulk endpoint for managing project level autofix automation settings."""

    owner = ApiOwner.CODING_WORKFLOWS

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project) -> Response:
        """
        Specific project with its autofix automation settings.

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :pparam string project_id_or_slug: project ID to read.
        :auth: required
        """

        autofix_automation_tuning = ProjectOption.objects.get_value(
            project, "sentry:autofix_automation_tuning"
        )

        raw_prefs = get_project_seer_preferences(project.id)
        seer_pref = raw_prefs.preference if raw_prefs else None

        return Response(
            status=200,
            data={
                "projectId": project.id,
                "autofixAutomationTuning": autofix_automation_tuning
                or AutofixAutomationTuningSettings.OFF.value,
                "automatedRunStoppingPoint": (
                    (seer_pref.automated_run_stopping_point if seer_pref else None)
                    or AutofixStoppingPoint.CODE_CHANGES.value
                ),
                "reposCount": len(seer_pref.repositories if seer_pref else []),
            },
        )

    def put(self, request: Request, project: Project) -> Response:
        """
        Update the autofix automation settings for a project.

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :pparam string project_id_or_slug: the id or slug of the project.
        :auth: required
        """
        serializer = SeerAutofixSettingsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        autofix_automation_tuning = serializer.validated_data.get("autofixAutomationTuning")
        automated_run_stopping_point = serializer.validated_data.get("automatedRunStoppingPoint")

        preferences_to_set: list[dict[str, Any]] = []
        if automated_run_stopping_point:
            raw_prefs = get_project_seer_preferences(project.id)
            seer_pref = raw_prefs.preference if raw_prefs else None

            preferences_to_set.append(
                {
                    **(seer_pref.dict() if seer_pref else {}),
                    "automated_run_stopping_point": automated_run_stopping_point,
                }
            )

        # Wrap DB writes and Seer API call in a transaction.
        # If Seer API fails, DB changes are rolled back.
        with transaction.atomic(router.db_for_write(ProjectOption)):
            if autofix_automation_tuning:
                autofix_automation_tuning_value = (
                    autofix_automation_tuning or AutofixAutomationTuningSettings.OFF
                )

                project.update_option(
                    "sentry:autofix_automation_tuning", autofix_automation_tuning_value
                )

            if preferences_to_set:
                bulk_set_project_preferences(project.organization.id, preferences_to_set)

        return Response(status=204)
