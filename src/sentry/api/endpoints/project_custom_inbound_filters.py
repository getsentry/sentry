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

MAX_CONDITIONS_PER_FILTER = 10
MAX_FILTERS_PER_PROJECT = 50


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


class CustomInboundFilterConditionSerializer(serializers.Serializer[CustomInboundFilterCondition]):
    type = serializers.ChoiceField(
        choices=[condition_type.value for condition_type in CustomInboundFilterConditionType]
    )
    value = serializers.ListField(
        child=serializers.CharField(allow_blank=False, trim_whitespace=True),
        allow_empty=False,
    )


class CustomInboundFilterSerializer(serializers.ModelSerializer[CustomInboundFilter]):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(
        max_length=256, allow_blank=True, allow_null=True, required=False, trim_whitespace=True
    )
    active = serializers.BooleanField(required=False)
    conditions = CustomInboundFilterConditionSerializer(
        many=True,
        allow_empty=False,
        max_length=MAX_CONDITIONS_PER_FILTER,  # type: ignore[call-arg]  # many=True -> ListSerializer
        help_text=(
            "Conditions are combined with AND: an event must match every condition to be "
            "filtered out. There is no OR between conditions, so e.g. two release conditions "
            "can express a range (>2 AND <4). To broaden matching, widen a condition's values "
            "or add separate filters."
        ),
    )
    dateCreated = serializers.DateTimeField(source="date_added", read_only=True)
    dateUpdated = serializers.DateTimeField(source="date_updated", read_only=True)

    class Meta:
        model = CustomInboundFilter
        fields = ["id", "name", "active", "conditions", "dateCreated", "dateUpdated"]

    def create(self, validated_data: dict[str, Any]) -> CustomInboundFilter:
        return CustomInboundFilter.objects.create(**validated_data)

    def validate_conditions(self, conditions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        organization = self.context["project"].organization
        request = self.context["request"]
        condition_types = [condition["type"] for condition in conditions]

        primary_condition_types = PRIMARY_CONDITION_TYPES.intersection(condition_types)
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
        if len(primary_condition_types) > 1:
            raise serializers.ValidationError(
                "Only one of error_message, log_message, or metric_name can be used in a filter."
            )

        return conditions


class ProjectCustomInboundFilterEndpoint(ProjectEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (ProjectSettingPermission,)

    def has_feature(self, request: Request, project: Project) -> bool:
        if not features.has(
            "organizations:inbound-filters-v2", project.organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        return features.has("projects:custom-inbound-filters", project, actor=request.user)

    @staticmethod
    def get_audit_log_data(
        project: Project,
        custom_filter: CustomInboundFilter,
        operation: str,
        changes: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        data: dict[str, Any] = {
            "project_slug": project.slug,
            "filter_id": str(custom_filter.id),
            "filter_name": custom_filter.name,
            "active": custom_filter.active,
            "conditions": custom_filter.conditions,
            "operation": operation,
        }

        if changes:
            data["changes"] = changes

        return data


@cell_silo_endpoint
@extend_schema(tags=["Projects"])
class CustomInboundFiltersEndpoint(ProjectCustomInboundFilterEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }

    @extend_schema(
        operation_id="List a Project's Custom Inbound Filters",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        responses={
            200: CustomInboundFilterSerializer(many=True),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project: Project) -> Response:
        """
        List the custom inbound filters configured for a project.
        """
        if not self.has_feature(request, project):
            return Response({"detail": "You do not have that feature enabled"}, status=400)

        filters = CustomInboundFilter.objects.filter(project_id=project.id)
        return self.paginate(
            request=request,
            queryset=filters,
            order_by="id",
            paginator_cls=OffsetPaginator,
            on_results=lambda results: CustomInboundFilterSerializer(results, many=True).data,
        )

    @extend_schema(
        operation_id="Create a Custom Inbound Filter",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=CustomInboundFilterSerializer,
        responses={
            201: CustomInboundFilterSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, project: Project) -> Response:
        """
        Create a custom inbound filter for a project.
        """
        if not self.has_feature(request, project):
            return Response({"detail": "You do not have that feature enabled"}, status=400)

        if CustomInboundFilter.objects.filter(project_id=project.id).count() >= (
            MAX_FILTERS_PER_PROJECT
        ):
            return Response(
                {
                    "detail": (
                        f"A project can have at most {MAX_FILTERS_PER_PROJECT} custom inbound "
                        "filters."
                    )
                },
                status=400,
            )

        serializer = CustomInboundFilterSerializer(
            data=request.data,
            context={"project": project, "request": request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        custom_filter = serializer.save(project=project)

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=custom_filter.id,
            event=audit_log.get_event_id("CUSTOM_INBOUND_FILTER"),
            data=self.get_audit_log_data(project, custom_filter, "add"),
        )

        return Response(serializer.data, status=201)
