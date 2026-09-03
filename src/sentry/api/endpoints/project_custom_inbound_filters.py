from __future__ import annotations

from collections.abc import Mapping
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
from sentry.ingest.inbound_filters import get_supported_condition_types
from sentry.models.custominboundfilter import (
    CustomInboundFilter,
    CustomInboundFilterConditionType,
    CustomInboundFilterDataType,
)
from sentry.models.project import Project
from sentry.tasks.relay import schedule_invalidate_project_config

MAX_CONDITIONS_PER_FILTER = 10
MAX_FILTERS_PER_PROJECT = 50


# Ingestion feature an organization needs before a filter can target a data type.
_REQUIRED_FEATURE_BY_DATA_TYPE: Mapping[CustomInboundFilterDataType, str] = {
    CustomInboundFilterDataType.LOG: "organizations:ourlogs-ingestion",
    CustomInboundFilterDataType.METRIC: "organizations:tracemetrics-ingestion",
}


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
    dataType = serializers.ChoiceField(
        source="data_type",
        choices=[data_type.value for data_type in CustomInboundFilterDataType],
        help_text=(
            "The data the filter matches against. `all` is the catch-all: it filters every "
            "data type Sentry ingests, including ones added later, and accepts only the "
            "conditions that every data type carries a field for."
        ),
    )
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
        fields = ["id", "name", "active", "dataType", "conditions", "dateCreated", "dateUpdated"]

    def create(self, validated_data: dict[str, Any]) -> CustomInboundFilter:
        return CustomInboundFilter.objects.create(**validated_data)

    def validate_dataType(self, data_type: str) -> str:
        organization = self.context["project"].organization
        request = self.context["request"]

        required_feature = _REQUIRED_FEATURE_BY_DATA_TYPE.get(
            CustomInboundFilterDataType(data_type)
        )
        if required_feature and not features.has(
            required_feature, organization, actor=request.user
        ):
            raise serializers.ValidationError(
                f"{data_type.capitalize()} filters are not enabled for this organization."
            )

        return data_type

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        # A partial update may change the data type or the conditions alone, so the
        # other side comes from the stored filter.
        stored = self.instance
        conditions = attrs.get("conditions")
        if conditions is None:
            conditions = stored.conditions if stored else None

        raw_data_type = attrs.get("data_type") or (stored.data_type if stored else None)
        if conditions is None or raw_data_type is None:
            return attrs

        data_type = CustomInboundFilterDataType(raw_data_type)
        supported = get_supported_condition_types(data_type)
        unsupported = sorted({condition["type"] for condition in conditions} - set(supported))
        if unsupported:
            raise serializers.ValidationError(
                {
                    "conditions": (
                        f"A filter on {data_type.value} data cannot use the "
                        f"{', '.join(unsupported)} condition. It accepts "
                        f"{', '.join(supported)}."
                    )
                }
            )

        return attrs


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
            "data_type": custom_filter.data_type,
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
        schedule_invalidate_project_config(project_id=project.id, trigger="custom_inbound_filters")

        return Response(serializer.data, status=201)


@cell_silo_endpoint
@extend_schema(tags=["Projects"])
class CustomInboundFilterDetailsEndpoint(ProjectCustomInboundFilterEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }

    def get_custom_inbound_filter(self, project: Project, filter_id: str) -> CustomInboundFilter:
        try:
            return CustomInboundFilter.objects.get(id=filter_id, project_id=project.id)
        except (CustomInboundFilter.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

    @extend_schema(
        operation_id="Retrieve a Custom Inbound Filter",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        responses={
            200: CustomInboundFilterSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project: Project, filter_id: str) -> Response:
        """
        Retrieve a single custom inbound filter.
        """
        if not self.has_feature(request, project):
            return Response({"detail": "You do not have that feature enabled"}, status=400)

        custom_filter = self.get_custom_inbound_filter(project, filter_id)
        return Response(CustomInboundFilterSerializer(custom_filter).data)

    @extend_schema(
        operation_id="Update a Custom Inbound Filter",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=CustomInboundFilterSerializer,
        responses={
            200: CustomInboundFilterSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(self, request: Request, project: Project, filter_id: str) -> Response:
        """
        Update a custom inbound filter's name, active state, or conditions.
        """
        if not self.has_feature(request, project):
            return Response({"detail": "You do not have that feature enabled"}, status=400)

        custom_filter = self.get_custom_inbound_filter(project, filter_id)
        serializer = CustomInboundFilterSerializer(
            custom_filter,
            data=request.data,
            partial=True,
            context={"project": project, "request": request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        changes: dict[str, Any] = {}
        for field in ("name", "active", "data_type", "conditions"):
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
                event=audit_log.get_event_id("CUSTOM_INBOUND_FILTER"),
                data=self.get_audit_log_data(project, custom_filter, "edit", changes),
            )
            if changes.keys() & {"active", "data_type", "conditions"}:
                schedule_invalidate_project_config(
                    project_id=project.id, trigger="custom_inbound_filters"
                )

        return Response(CustomInboundFilterSerializer(custom_filter).data)

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
        """
        Delete a custom inbound filter.
        """
        if not self.has_feature(request, project):
            return Response({"detail": "You do not have that feature enabled"}, status=400)

        custom_filter = self.get_custom_inbound_filter(project, filter_id)
        audit_log_data = self.get_audit_log_data(project, custom_filter, "remove")
        target_object = custom_filter.id
        custom_filter.delete()

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=target_object,
            event=audit_log.get_event_id("CUSTOM_INBOUND_FILTER"),
            data=audit_log_data,
        )
        schedule_invalidate_project_config(project_id=project.id, trigger="custom_inbound_filters")

        return Response(status=204)
