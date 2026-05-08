from __future__ import annotations

from typing import TypedDict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.models.project import Project
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    AutomationCodingAgent,
    build_automation_handoff,
    get_valid_automated_run_stopping_points,
    update_seer_project_settings,
)
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.seer.models.seer_api_models import SeerAutomationHandoffConfiguration


class SeerProjectSettings(TypedDict):
    automation_tuning: str
    handoff: SeerAutomationHandoffConfiguration | None
    repos_count: int
    scanner_automation: bool
    stopping_point: str


class SeerProjectSettingsResponse(TypedDict):
    projectId: str
    projectSlug: str
    agent: str
    integrationId: str | None
    stoppingPoint: str
    scannerAutomation: bool
    reposCount: int


def _get_project_settings(project: Project) -> SeerProjectSettings:
    return SeerProjectSettings(
        automation_tuning=project.get_option("sentry:autofix_automation_tuning"),
        scanner_automation=project.get_option("sentry:seer_scanner_automation"),
        stopping_point=project.get_option("sentry:seer_automated_run_stopping_point"),
        handoff=build_automation_handoff(project.get_option),
        repos_count=SeerProjectRepository.objects.filter(
            project=project, repository__status=ObjectStatus.ACTIVE
        ).count(),
    )


def _serialize(project: Project, settings: SeerProjectSettings) -> SeerProjectSettingsResponse:
    # Automation tuning is a high-level toggle (OFF / LOW / MEDIUM / HIGH) that
    # controls whether Seer runs automatically at all. When it's OFF, report
    # stopping point as "off" regardless of the stored value so the UI reports
    # disabled automation instead of an active stopping point.
    stopping_point = (
        "off"
        if settings["automation_tuning"] == AutofixAutomationTuningSettings.OFF
        else settings["stopping_point"]
    )

    handoff = settings["handoff"]
    if handoff is None:
        # No configured external handoff means use Seer agent.
        agent: str = "seer"
        integration_id: str | None = None
    else:
        agent = handoff.target
        integration_id = str(handoff.integration_id)

    return SeerProjectSettingsResponse(
        projectId=str(project.id),
        projectSlug=project.slug,
        agent=agent,
        integrationId=integration_id,
        stoppingPoint=stopping_point,
        scannerAutomation=settings["scanner_automation"],
        reposCount=settings["repos_count"],
    )


def serialize_project(project: Project) -> SeerProjectSettingsResponse:
    return _serialize(project, _get_project_settings(project))


class ProjectSettingsUpdateSerializer(serializers.Serializer):
    agent = serializers.ChoiceField(choices=[*AutomationCodingAgent], required=False)
    integrationId = serializers.IntegerField(required=False)
    stoppingPoint = serializers.ChoiceField(choices=["off", *AutofixStoppingPoint], required=False)
    scannerAutomation = serializers.BooleanField(required=False)

    def validate_stoppingPoint(self, value: str) -> str:
        if value == "off":
            return value

        organization = self.context["organization"]
        if value not in get_valid_automated_run_stopping_points(organization):
            raise serializers.ValidationError(f'"{value}" is not a valid choice.')
        return value

    def validate_integrationId(self, value: int) -> int:
        organization = self.context["organization"]
        org_integrations = integration_service.get_organization_integrations(
            organization_id=organization.id, integration_id=value
        )
        if not org_integrations:
            raise serializers.ValidationError(f"{value} is not a valid integration.")
        return value

    def validate(self, data):
        if "agent" in data and data["agent"] != "seer" and "integrationId" not in data:
            raise serializers.ValidationError(
                {"integrationId": "Required when agent is an external coding agent."}
            )

        has_update = any(k in data for k in ("agent", "stoppingPoint", "scannerAutomation"))
        if not has_update:
            raise serializers.ValidationError("At least one update field must be provided.")

        return data


@cell_silo_endpoint
class ProjectSeerSettingsEndpoint(ProjectEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectEventPermission,)

    def get(self, request: Request, project: Project) -> Response:
        return Response(serialize_project(project))

    def put(self, request: Request, project: Project) -> Response:
        serializer = ProjectSettingsUpdateSerializer(
            data=request.data, context={"organization": project.organization}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        update_seer_project_settings(project, serializer.validated_data)

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=audit_log.get_event_id("AUTOFIX_SETTINGS_EDIT"),
            data={"project_id": project.id},
        )

        return Response(serialize_project(project))
