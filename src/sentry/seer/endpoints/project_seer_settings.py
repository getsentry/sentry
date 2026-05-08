from __future__ import annotations

from typing import Any, TypedDict

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
from sentry.projectoptions.defaults import SEER_PROJECT_PREFERENCE_OPTION_KEYS
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    AutomationCodingAgent,
    build_automation_handoff,
    get_valid_automated_run_stopping_points,
    update_seer_project_settings,
)
from sentry.seer.models.project_repository import SeerProjectRepository


class SeerProjectSettingsResponse(TypedDict):
    projectId: str
    projectSlug: str
    agent: str
    integrationId: str | None
    stoppingPoint: str
    scannerAutomation: bool
    reposCount: int


def _serialize_seer_project_settings(
    project: Project, attrs: dict[str, Any]
) -> SeerProjectSettingsResponse:
    # Only use the real stopping point if tuning is on.
    tuning = attrs["sentry:autofix_automation_tuning"]
    stopping_point = (
        "off"
        if tuning == AutofixAutomationTuningSettings.OFF
        else attrs["sentry:seer_automated_run_stopping_point"]
    )

    # No configured external handoff means use Seer agent.
    handoff = build_automation_handoff(attrs.get)
    if handoff is None:
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
        scannerAutomation=attrs["sentry:seer_scanner_automation"],
        reposCount=attrs["repos_count"],
    )


def _get_attrs_for_project(project: Project) -> dict[str, Any]:
    attrs: dict[str, Any] = {}

    for key in SEER_PROJECT_PREFERENCE_OPTION_KEYS:
        attrs[key] = project.get_option(key)

    attrs["repos_count"] = SeerProjectRepository.objects.filter(
        project=project, repository__status=ObjectStatus.ACTIVE
    ).count()

    return attrs


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
        attrs = _get_attrs_for_project(project)
        return Response(_serialize_seer_project_settings(project, attrs))

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

        return Response(_serialize_seer_project_settings(project, _get_attrs_for_project(project)))
