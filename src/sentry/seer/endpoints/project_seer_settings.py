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
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.event_search import QueryToken, SearchConfig, SearchFilter
from sentry.api.event_search import parse_search_query as base_parse_search_query
from sentry.api.paginator import OffsetPaginator
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
    build_automation_handoff,
    get_valid_automated_run_stopping_points,
    update_seer_project_settings,
)
from sentry.seer.models.project_repository import SeerProjectRepository
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


def _get_attrs_for_projects(
    projects: list[Project],
) -> dict[int, dict[str, Any]]:
    """For each project, construct a dict containing repos_count and the relevant Seer project options."""
    if not projects:
        return {}

    project_ids = [p.id for p in projects]

    project_options: dict[str, Mapping[int, Any]] = {
        key: ProjectOption.objects.get_value_bulk_id(project_ids, key)
        for key in SEER_PROJECT_PREFERENCE_OPTION_KEYS
    }

    repo_counts: dict[int, int] = dict(
        SeerProjectRepository.objects.filter(
            project_id__in=project_ids, repository__status=ObjectStatus.ACTIVE
        )
        .values_list("project_id")
        .annotate(count=Count("id"))
        .values_list("project_id", "count")
    )

    attrs_by_project: dict[int, dict[str, Any]] = {}
    for project in projects:
        attrs_by_project[project.id] = {}

        for key in SEER_PROJECT_PREFERENCE_OPTION_KEYS:
            value = project_options[key].get(project.id)
            if value is None:
                value = projectoptions.get_well_known_default(key, project=project)
            attrs_by_project[project.id][key] = value

        attrs_by_project[project.id]["repos_count"] = repo_counts.get(project.id, 0)

    return attrs_by_project


def _annotate_queryset(queryset):
    # ProjectOption.value is a LegacyTextJSONField — a text column storing JSON.
    # Use LegacyTextJSONField as output_field. Coalesce fallback values must also
    # be JSON-encoded to match what the DB stores.

    def _project_option_subquery(key: str) -> Subquery:
        return Subquery(
            ProjectOption.objects.filter(project_id=OuterRef("id"), key=key).values("value")[:1],
            output_field=LegacyTextJSONField(),
        )

    return queryset.annotate(
        repos_count=Count(
            "seerprojectrepository",
            filter=Q(seerprojectrepository__repository__status=ObjectStatus.ACTIVE),
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
            if op in (">", "<", ">=", "<="):
                raise InvalidSearchQuery("id does not support range operators.")
            if op == "IN":
                queryset = queryset.filter(id__in=[int(v) for v in value])
            elif op == "NOT IN":
                queryset = queryset.exclude(id__in=[int(v) for v in value])
            elif op == "=":
                queryset = queryset.filter(id=int(value))
            elif op == "!=":
                queryset = queryset.exclude(id=int(value))

        elif key == "name":
            if op == "=":
                queryset = queryset.filter(Q(name__icontains=value) | Q(slug__icontains=value))
            elif op == "!=":
                queryset = queryset.exclude(Q(name__icontains=value) | Q(slug__icontains=value))

        elif key == "reposCount":
            if op in ("IN", "NOT IN"):
                raise InvalidSearchQuery("reposCount does not support IN/NOT IN operators.")
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
            if op == "IN":
                queryset = queryset.filter(stopping_point__in=value)
            elif op == "NOT IN":
                queryset = queryset.exclude(stopping_point__in=value)
            elif op == "=":
                queryset = queryset.filter(stopping_point=value)
            elif op == "!=":
                queryset = queryset.exclude(stopping_point=value)

        elif key == "agent":
            if op == "IN":
                queryset = queryset.filter(agent__in=value)
            elif op == "NOT IN":
                queryset = queryset.exclude(agent__in=value)
            elif op == "=":
                queryset = queryset.filter(agent=value)
            elif op == "!=":
                queryset = queryset.exclude(agent=value)

    return queryset


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


class BulkProjectSettingsUpdateSerializer(ProjectSettingsUpdateSerializer):
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

        def on_results(projects: list[Project]) -> list[SeerProjectSettingsResponse]:
            attrs_by_project = _get_attrs_for_projects(projects)
            return [_serialize_seer_project_settings(p, attrs_by_project[p.id]) for p in projects]

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            on_results=on_results,
            paginator_cls=OffsetPaginator,
        )

    def put(self, request: Request, organization: Organization) -> Response:
        serializer = BulkProjectSettingsUpdateSerializer(
            data=request.data, context={"organization": organization}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        search_query = data.pop("query")

        accessible_projects = self.get_projects(request, organization)
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
        for project in projects:
            update_seer_project_settings(project, data)

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=organization.id,
            event=audit_log.get_event_id("AUTOFIX_SETTINGS_EDIT"),
            data={
                "project_count": len(projects),
                "project_ids": [p.id for p in projects],
            },
        )

        return Response(status=204)
