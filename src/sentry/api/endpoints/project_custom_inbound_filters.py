from __future__ import annotations

from enum import StrEnum
from typing import Any, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams
from sentry.models.custominboundfilter import CustomInboundFilter
from sentry.models.project import Project


class CustomInboundFilterConditionType(StrEnum):
    ERROR_MESSAGE = "error_message"
    LOG_MESSAGE = "log_message"
    METRIC_NAME = "metric_name"
    RELEASE = "release"


PRIMARY_CONDITION_TYPES = frozenset(
    (
        CustomInboundFilterConditionType.ERROR_MESSAGE,
        CustomInboundFilterConditionType.LOG_MESSAGE,
        CustomInboundFilterConditionType.METRIC_NAME,
    )
)


class CustomInboundFilterCondition(TypedDict):
    type: str
    value: list[str]


class CustomInboundFilterResponse(TypedDict):
    id: str
    name: str | None
    active: bool
    conditions: list[CustomInboundFilterCondition]
    dateCreated: str
    dateUpdated: str


class CustomInboundFilterConditionSerializer(serializers.Serializer):
    type = serializers.ChoiceField(
        choices=[condition_type.value for condition_type in CustomInboundFilterConditionType]
    )
    value = serializers.ListField(
        child=serializers.CharField(allow_blank=False, trim_whitespace=True),
        allow_empty=False,
    )


class CustomInboundFilterSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=256, allow_blank=True, allow_null=True, required=False, trim_whitespace=True
    )
    active = serializers.BooleanField(required=False)
    conditions = CustomInboundFilterConditionSerializer(many=True, allow_empty=False)

    def validate_conditions(self, conditions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        condition_types = [condition["type"] for condition in conditions]

        if len(condition_types) != len(set(condition_types)):
            raise serializers.ValidationError("Condition types must be unique.")

        primary_condition_types = PRIMARY_CONDITION_TYPES.intersection(condition_types)
        if len(primary_condition_types) > 1:
            raise serializers.ValidationError(
                "Only one of error_message, log_message, or metric_name can be used in a filter."
            )

        organization = self.context["project"].organization
        request = self.context["request"]

        if CustomInboundFilterConditionType.LOG_MESSAGE in condition_types and not features.has(
            "organizations:ourlogs-ingestion", organization, actor=request.user
        ):
            raise serializers.ValidationError(
                "Log message filters are not enabled for this organization."
            )

        if CustomInboundFilterConditionType.METRIC_NAME in condition_types and not features.has(
            "organizations:tracemetrics-ingestion", organization, actor=request.user
        ):
            raise serializers.ValidationError(
                "Metric name filters are not enabled for this organization."
            )

        return conditions


def serialize_project_custom_inbound_filter(
    custom_filter: CustomInboundFilter,
) -> CustomInboundFilterResponse:
    return {
        "id": str(custom_filter.id),
        "name": custom_filter.name,
        "active": custom_filter.active,
        "conditions": custom_filter.conditions,
        "dateCreated": custom_filter.date_added.isoformat(),
        "dateUpdated": custom_filter.date_updated.isoformat(),
    }


def get_custom_inbound_filter(project: Project, filter_id: str) -> CustomInboundFilter:
    try:
        return CustomInboundFilter.objects.get(id=filter_id, project_id=project.id)
    except (CustomInboundFilter.DoesNotExist, ValueError):
        raise ResourceDoesNotExist


def get_feature_gate_response(request: Request, project: Project) -> Response | None:
    if not features.has(
        "organizations:inbound-filters-v2", project.organization, actor=request.user
    ):
        raise ResourceDoesNotExist

    if not features.has("projects:custom-inbound-filters", project, actor=request.user):
        return Response({"detail": "You do not have that feature enabled"}, status=400)

    return None


def get_audit_log_data(
    project: Project,
    custom_filter: CustomInboundFilter,
    changes: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "project_slug": project.slug,
        "filter_id": str(custom_filter.id),
        "filter_name": custom_filter.name,
        "active": custom_filter.active,
        "conditions": custom_filter.conditions,
    }

    if changes:
        data["changes"] = changes

    return data


@cell_silo_endpoint
@extend_schema(tags=["Projects"])
class CustomInboundFiltersEndpoint(ProjectEndpoint):
    owner = ApiOwner.UNOWNED
    permission_classes = (ProjectSettingPermission,)
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="List a Project's Custom Inbound Filters",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        responses={
            200: list[CustomInboundFilterResponse],
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project: Project) -> Response:
        if feature_gate_response := get_feature_gate_response(request, project):
            return feature_gate_response

        filters = CustomInboundFilter.objects.filter(project_id=project.id)
        return self.paginate(
            request=request,
            queryset=filters,
            order_by="id",
            paginator_cls=OffsetPaginator,
            on_results=lambda results: [
                serialize_project_custom_inbound_filter(custom_filter) for custom_filter in results
            ],
        )

    @extend_schema(
        operation_id="Create a Custom Inbound Filter",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=CustomInboundFilterSerializer,
        responses={
            201: CustomInboundFilterResponse,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, project: Project) -> Response:
        if feature_gate_response := get_feature_gate_response(request, project):
            return feature_gate_response

        serializer = CustomInboundFilterSerializer(
            data=request.data,
            context={"project": project, "request": request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        custom_filter = CustomInboundFilter.objects.create(
            project=project,
            name=serializer.validated_data.get("name"),
            active=serializer.validated_data.get("active", True),
            conditions=serializer.validated_data["conditions"],
        )

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=custom_filter.id,
            event=audit_log.get_event_id("CUSTOM_INBOUND_FILTER_ADD"),
            data=get_audit_log_data(project, custom_filter),
        )

        return Response(serialize_project_custom_inbound_filter(custom_filter), status=201)


@cell_silo_endpoint
@extend_schema(tags=["Projects"])
class CustomInboundFilterDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.UNOWNED
    permission_classes = (ProjectSettingPermission,)
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="Retrieve a Custom Inbound Filter",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        responses={
            200: CustomInboundFilterResponse,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project: Project, filter_id: str) -> Response:
        if feature_gate_response := get_feature_gate_response(request, project):
            return feature_gate_response

        custom_filter = get_custom_inbound_filter(project, filter_id)
        return Response(serialize_project_custom_inbound_filter(custom_filter))

    @extend_schema(
        operation_id="Update a Custom Inbound Filter",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=CustomInboundFilterSerializer,
        responses={
            200: CustomInboundFilterResponse,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(self, request: Request, project: Project, filter_id: str) -> Response:
        if feature_gate_response := get_feature_gate_response(request, project):
            return feature_gate_response

        custom_filter = get_custom_inbound_filter(project, filter_id)
        serializer = CustomInboundFilterSerializer(
            custom_filter,
            data=request.data,
            partial=True,
            context={"project": project, "request": request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        changes = {}
        for field in ("name", "active", "conditions"):
            if field not in serializer.validated_data:
                continue

            previous_value = getattr(custom_filter, field)
            new_value = serializer.validated_data[field]
            if previous_value != new_value:
                changes[field] = {"old": previous_value, "new": new_value}
                setattr(custom_filter, field, new_value)

        if changes:
            custom_filter.save(update_fields=[*changes.keys(), "date_updated"])
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=custom_filter.id,
                event=audit_log.get_event_id("CUSTOM_INBOUND_FILTER_EDIT"),
                data=get_audit_log_data(project, custom_filter, changes),
            )

        return Response(serialize_project_custom_inbound_filter(custom_filter))

    @extend_schema(
        operation_id="Delete a Custom Inbound Filter",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        responses={
            204: None,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, project: Project, filter_id: str) -> Response:
        if feature_gate_response := get_feature_gate_response(request, project):
            return feature_gate_response

        custom_filter = get_custom_inbound_filter(project, filter_id)
        audit_log_data = get_audit_log_data(project, custom_filter)
        target_object = custom_filter.id
        custom_filter.delete()

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=target_object,
            event=audit_log.get_event_id("CUSTOM_INBOUND_FILTER_REMOVE"),
            data=audit_log_data,
        )

        return Response(status=204)
