from __future__ import annotations

from collections.abc import Mapping, Sequence
from functools import partial
from typing import Any, TypedDict

from django.db.models import Case, Count, F, IntegerField, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Coalesce
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, projectoptions
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.event_search import QueryToken, SearchConfig, SearchFilter
from sentry.api.event_search import parse_search_query as base_parse_search_query
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.constants import (
    AUTOFIX_AUTOMATION_TUNING_DEFAULT,
    SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT,
    ObjectStatus,
)
from sentry.db.models.fields.jsonfield import LegacyTextJSONField
from sentry.exceptions import InvalidSearchQuery
from sentry.integrations.services.integration import integration_service
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.projectoptions.defaults import SEER_PROJECT_PREFERENCE_OPTION_KEYS
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.issue_summary import STOPPING_POINT_HIERARCHY
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    AutomationCodingAgent,
    get_automation_handoff,
    get_valid_automated_run_stopping_points,
    is_seer_seat_based_tier_enabled,
    update_seer_project_settings,
)
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.seer.models.seer_api_models import SeerAutomationHandoffConfiguration
from sentry.utils import json

SORT_FIELDS_MAPPING: dict[str, str] = {
    "name": "slug",
    "-name": "-slug",
    "reposCount": "repos_count",
    "-reposCount": "-repos_count",
    "agent": "agent",
    "-agent": "-agent",
    "stoppingPoint": "stopping_point_rank",
    "-stoppingPoint": "-stopping_point_rank",
}

search_config = SearchConfig.create_from(
    SearchConfig(),
    allowed_keys={"id", "name", "reposCount", "stoppingPoint", "agent"},
    numeric_keys={"id", "reposCount"},
    allow_boolean=False,
    free_text_key="name",
)
parse_search_query = partial(base_parse_search_query, config=search_config)


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
    autoCreatePr: bool | None
    automationTuning: str
    scannerAutomation: bool
    reposCount: int


def _get_project_settings(project: Project) -> SeerProjectSettings:
    return SeerProjectSettings(
        automation_tuning=project.get_option("sentry:autofix_automation_tuning"),
        scanner_automation=project.get_option("sentry:seer_scanner_automation"),
        stopping_point=project.get_option("sentry:seer_automated_run_stopping_point"),
        handoff=get_automation_handoff(project.get_option),
        repos_count=SeerProjectRepository.objects.filter(
            project_repository__project=project,
            project_repository__repository__status=ObjectStatus.ACTIVE,
        ).count(),
    )


def _bulk_get_project_settings(projects: list[Project]) -> dict[int, SeerProjectSettings]:
    if not projects:
        return {}

    project_ids = [p.id for p in projects]

    project_options: dict[str, Mapping[int, Any]] = {
        key: ProjectOption.objects.get_value_bulk_id(project_ids, key)
        for key in SEER_PROJECT_PREFERENCE_OPTION_KEYS
    }

    repo_counts: dict[int, int] = dict(
        SeerProjectRepository.objects.filter(
            project_repository__project_id__in=project_ids,
            project_repository__repository__status=ObjectStatus.ACTIVE,
        )
        .values_list("project_repository__project_id")
        .annotate(count=Count("id"))
        .values_list("project_repository__project_id", "count")
    )

    settings_by_project_id: dict[int, SeerProjectSettings] = {}
    for project in projects:

        def _get_option(key: str):
            value = project_options[key].get(project.id)
            if value is None:
                value = projectoptions.get_well_known_default(key, project=project)
            return value

        settings_by_project_id[project.id] = SeerProjectSettings(
            automation_tuning=_get_option("sentry:autofix_automation_tuning"),
            scanner_automation=_get_option("sentry:seer_scanner_automation"),
            stopping_point=_get_option("sentry:seer_automated_run_stopping_point"),
            handoff=get_automation_handoff(_get_option),
            repos_count=repo_counts.get(project.id, 0),
        )

    return settings_by_project_id


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
        auto_create_pr: bool | None = None
    else:
        agent = handoff.target
        integration_id = str(handoff.integration_id)
        auto_create_pr = handoff.auto_create_pr

    return SeerProjectSettingsResponse(
        projectId=str(project.id),
        projectSlug=project.slug,
        agent=agent,
        integrationId=integration_id,
        stoppingPoint=stopping_point,
        autoCreatePr=auto_create_pr,
        automationTuning=settings["automation_tuning"],
        scannerAutomation=settings["scanner_automation"],
        reposCount=settings["repos_count"],
    )


def serialize_project(project: Project) -> SeerProjectSettingsResponse:
    return _serialize(project, _get_project_settings(project))


def serialize_projects(projects: list[Project]) -> list[SeerProjectSettingsResponse]:
    settings_by_project_id = _bulk_get_project_settings(projects)
    return [_serialize(p, settings_by_project_id[p.id]) for p in projects]


def _annotate_queryset(queryset):
    # ProjectOption.value is a LegacyTextJSONField — a text column storing JSON.
    # Use LegacyTextJSONField as output_field for project options. Coalesce fallback
    # values must also be JSON-encoded.

    def _project_option_subquery(key: str) -> Subquery:
        return Subquery(
            ProjectOption.objects.filter(project_id=OuterRef("id"), key=key).values("value")[:1],
            output_field=LegacyTextJSONField(),
        )

    return queryset.annotate(
        repos_count=Count(
            "projectrepository__seerprojectrepository",
            filter=Q(projectrepository__repository__status=ObjectStatus.ACTIVE),
        ),
        _tuning=Coalesce(
            _project_option_subquery("sentry:autofix_automation_tuning"),
            Value(json.dumps(AUTOFIX_AUTOMATION_TUNING_DEFAULT)),
            output_field=LegacyTextJSONField(),
        ),
        stopping_point=Case(
            When(_tuning=AutofixAutomationTuningSettings.OFF, then=Value(json.dumps("off"))),
            default=Coalesce(
                _project_option_subquery("sentry:seer_automated_run_stopping_point"),
                Value(json.dumps(SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT)),
                output_field=LegacyTextJSONField(),
            ),
            output_field=LegacyTextJSONField(),
        ),
        # Map stopping point strings to integer ranks so we can order by them.
        stopping_point_rank=Case(
            When(_tuning=AutofixAutomationTuningSettings.OFF, then=Value(0)),
            *[
                When(stopping_point=point, then=Value(rank))
                for point, rank in STOPPING_POINT_HIERARCHY.items()
            ],
            default=Value(0),
            output_field=IntegerField(),
        ),
        _handoff_target=_project_option_subquery("sentry:seer_automation_handoff_target"),
        # We only check handoff_target here (not handoff_point/integration_id) because the
        # write path always sets or clears all three atomically.
        agent=Case(
            # No configured external handoff means use Seer agent.
            When(
                Q(_handoff_target__isnull=True)
                | Q(_handoff_target=Value(json.dumps(None), output_field=LegacyTextJSONField())),
                then=Value(json.dumps(AutomationCodingAgent.SEER)),
            ),
            default=F("_handoff_target"),
            output_field=LegacyTextJSONField(),
        ),
    )


def _apply_search_filters(queryset, filters: Sequence[QueryToken]):
    for f in filters:
        if not isinstance(f, SearchFilter):
            continue

        key = f.key.name
        op = f.operator
        value = f.value.value

        if key == "id":
            if op not in ("=", "!=", "IN", "NOT IN"):
                raise InvalidSearchQuery(f"id does not support the {op} operator.")
            if op == "IN":
                queryset = queryset.filter(id__in=[int(v) for v in value])
            elif op == "NOT IN":
                queryset = queryset.exclude(id__in=[int(v) for v in value])
            elif op == "=":
                queryset = queryset.filter(id=int(value))
            elif op == "!=":
                queryset = queryset.exclude(id=int(value))

        elif key == "name":
            if op not in ("=", "!="):
                raise InvalidSearchQuery(f"name does not support the {op} operator.")
            if op == "=":
                queryset = queryset.filter(Q(name__icontains=value) | Q(slug__icontains=value))
            elif op == "!=":
                queryset = queryset.exclude(Q(name__icontains=value) | Q(slug__icontains=value))

        elif key == "reposCount":
            if op not in ("=", "!=", ">", "<", ">=", "<="):
                raise InvalidSearchQuery(f"reposCount does not support the {op} operator.")
            count = int(value)
            if op == "=":
                queryset = queryset.filter(repos_count=count)
            elif op == "!=":
                queryset = queryset.exclude(repos_count=count)
            elif op == ">":
                queryset = queryset.filter(repos_count__gt=count)
            elif op == "<":
                queryset = queryset.filter(repos_count__lt=count)
            elif op == ">=":
                queryset = queryset.filter(repos_count__gte=count)
            elif op == "<=":
                queryset = queryset.filter(repos_count__lte=count)

        elif key == "stoppingPoint":
            if op not in ("=", "!=", "IN", "NOT IN"):
                raise InvalidSearchQuery(f"stoppingPoint does not support the {op} operator.")
            if op == "IN":
                queryset = queryset.filter(stopping_point__in=value)
            elif op == "NOT IN":
                queryset = queryset.exclude(stopping_point__in=value)
            elif op == "=":
                queryset = queryset.filter(stopping_point=value)
            elif op == "!=":
                queryset = queryset.exclude(stopping_point=value)

        elif key == "agent":
            if op not in ("=", "!=", "IN", "NOT IN"):
                raise InvalidSearchQuery(f"agent does not support the {op} operator.")
            if op == "IN":
                queryset = queryset.filter(agent__in=value)
            elif op == "NOT IN":
                queryset = queryset.exclude(agent__in=value)
            elif op == "=":
                queryset = queryset.filter(agent=value)
            elif op == "!=":
                queryset = queryset.exclude(agent=value)

    return queryset


class _BaseProjectSettingsUpdateSerializer(CamelSnakeSerializer):
    agent = serializers.ChoiceField(choices=[*AutomationCodingAgent], required=False)
    integration_id = serializers.IntegerField(required=False)
    stopping_point = serializers.ChoiceField(choices=[*AutofixStoppingPoint], required=False)
    scanner_automation = serializers.BooleanField(required=False)
    automation_tuning = serializers.ChoiceField(
        choices=[*AutofixAutomationTuningSettings], required=False
    )

    def _update_fields(self) -> set[str]:
        return {"agent", "stopping_point", "scanner_automation", "automation_tuning"}

    def validate_integration_id(self, value: int) -> int:
        organization = self.context["organization"]
        org_integrations = integration_service.get_organization_integrations(
            organization_id=organization.id, integration_id=value
        )
        if not org_integrations:
            raise serializers.ValidationError(f"{value} is not a valid integration.")
        return value

    def validate_stopping_point(self, value: str) -> str:
        if value not in get_valid_automated_run_stopping_points(self.context["organization"]):
            raise serializers.ValidationError(f'"{value}" is not a valid choice.')
        return value

    def validate(self, data):
        if "agent" in data and data["agent"] != "seer" and "integration_id" not in data:
            raise serializers.ValidationError(
                {"integration_id": "Required when agent is an external coding agent."}
            )

        if "integration_id" in data:
            if "agent" not in data:
                raise serializers.ValidationError(
                    {"agent": "Required when integration_id is provided."}
                )
            elif data["agent"] == "seer":
                raise serializers.ValidationError(
                    {"agent": "Must be an external coding agent when integration_id is provided."}
                )

        if not any(k in data for k in self._update_fields()):
            raise serializers.ValidationError("At least one update field must be provided.")

        return data


class ProjectSettingsUpdateSerializer(_BaseProjectSettingsUpdateSerializer):
    """Seat-based (new) Seer: restricted tuning choices, stopping point sync."""

    automation_tuning = serializers.ChoiceField(
        choices=[AutofixAutomationTuningSettings.OFF, AutofixAutomationTuningSettings.MEDIUM],
        required=False,
    )

    def validate(self, data):
        data = super().validate(data)

        # Keep stopping point in sync with handoff auto_create_pr.
        if "stopping_point" in data and "auto_create_pr" not in data:
            data["auto_create_pr"] = data["stopping_point"] == AutofixStoppingPoint.OPEN_PR

        return data


class LegacyProjectSettingsUpdateSerializer(_BaseProjectSettingsUpdateSerializer):
    """Legacy Seer: accepts auto_create_pr and all tuning/stopping point values."""

    auto_create_pr = serializers.BooleanField(required=False)

    def _update_fields(self) -> set[str]:
        return super()._update_fields() | {"auto_create_pr"}


@cell_silo_endpoint
class ProjectSeerSettingsEndpoint(ProjectEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectPermission,)

    def get(self, request: Request, project: Project) -> Response:
        return Response(serialize_project(project))

    def put(self, request: Request, project: Project) -> Response:
        serializer_cls = (
            ProjectSettingsUpdateSerializer
            if is_seer_seat_based_tier_enabled(project.organization)
            else LegacyProjectSettingsUpdateSerializer
        )
        serializer = serializer_cls(
            data=request.data, context={"organization": project.organization}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        update_seer_project_settings([project.id], data)

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=audit_log.get_event_id("AUTOFIX_SETTINGS_EDIT"),
            data={"project_id": project.id, **data},
        )

        return Response(serialize_project(project))


class BulkProjectSettingsUpdateSerializer(ProjectSettingsUpdateSerializer):
    query = serializers.CharField(required=False, default="")


class LegacyBulkProjectSettingsUpdateSerializer(LegacyProjectSettingsUpdateSerializer):
    query = serializers.CharField(required=False, default="")


@cell_silo_endpoint
class OrganizationSeerProjectSettingsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        sort_by = request.GET.get("sortBy", "name")
        order_by = SORT_FIELDS_MAPPING.get(sort_by)
        if order_by is None:
            return Response({"detail": f"Invalid sortBy: {sort_by}"}, status=400)

        accessible_projects = self.get_projects(request, organization, include_all_accessible=True)
        queryset = _annotate_queryset(
            Project.objects.filter(id__in={p.id for p in accessible_projects})
        )

        search_query = request.GET.get("query", "")
        if search_query:
            try:
                search_filters = parse_search_query(search_query)
                queryset = _apply_search_filters(queryset, search_filters)
            except (InvalidSearchQuery, ValueError):
                return Response({"detail": "Invalid search query"}, status=400)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            on_results=serialize_projects,
            paginator_cls=OffsetPaginator,
        )

    def put(self, request: Request, organization: Organization) -> Response:
        serializer_cls = (
            BulkProjectSettingsUpdateSerializer
            if is_seer_seat_based_tier_enabled(organization)
            else LegacyBulkProjectSettingsUpdateSerializer
        )
        serializer = serializer_cls(data=request.data, context={"organization": organization})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        search_query = data.pop("query")

        accessible_projects = self.get_projects(request, organization, include_all_accessible=True)
        queryset = _annotate_queryset(
            Project.objects.filter(id__in={p.id for p in accessible_projects})
        )

        if search_query:
            try:
                filters = parse_search_query(search_query)
                queryset = _apply_search_filters(queryset, filters)
            except (InvalidSearchQuery, ValueError):
                return Response({"detail": "Invalid search query"}, status=400)

        projects = list(queryset)
        if projects:
            update_seer_project_settings([p.id for p in projects], data)

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=organization.id,
            event=audit_log.get_event_id("AUTOFIX_SETTINGS_EDIT"),
            data={"project_count": len(projects), "project_ids": [p.id for p in projects], **data},
        )

        return Response(status=204)
