from datetime import datetime
from typing import Any, Literal, TypedDict

from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import serializers as rest_serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.rest_framework.base import camel_to_snake_case
from sentry.api.utils import get_date_range_from_params
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.flag_examples import FlagExamples
from sentry.apidocs.parameters import CursorQueryParam, FlagParams, GlobalParams, VisibilityParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.flags.models import (
    PROVIDER_MAP,
    ActionEnum,
    CreatedByTypeEnum,
    FlagAuditLogModel,
    ProviderEnum,
    ProviderName,
)
from sentry.models.organization import Organization


class FlagAuditLogModelSerializerResponse(TypedDict):
    id: int
    action: Literal["created", "deleted", "updated"]
    createdAt: datetime
    createdBy: str | None
    createdByType: Literal["email", "id", "name"] | None
    flag: str
    provider: ProviderName | None
    tags: dict[str, Any]


class FlagLogIndexResponse(TypedDict):
    data: list[FlagAuditLogModelSerializerResponse]


class FlagLogDetailsResponse(TypedDict):
    data: FlagAuditLogModelSerializerResponse


@register(FlagAuditLogModel)
class FlagAuditLogModelSerializer(Serializer[FlagAuditLogModelSerializerResponse]):
    def serialize(self, obj, attrs, user, **kwargs) -> FlagAuditLogModelSerializerResponse:
        return {
            "id": obj.id,
            "action": ActionEnum.to_string(obj.action),
            "createdAt": obj.created_at.isoformat(),
            "createdBy": obj.created_by,
            "createdByType": (
                None
                if obj.created_by_type is None
                else CreatedByTypeEnum.to_string(obj.created_by_type)
            ),
            "flag": obj.flag,
            "provider": (None if obj.provider is None else ProviderEnum.to_string(obj.provider)),
            "tags": obj.tags,
        }


SORT_FIELDS = ["action", "created_at", "created_by", "created_by_type", "flag", "provider"]


class FlagLogIndexRequestSerializer(rest_serializers.Serializer):
    # start, end handled separately.
    flag = rest_serializers.ListField(
        child=rest_serializers.CharField(),
        required=False,
    )
    provider = rest_serializers.ListField(
        child=rest_serializers.ChoiceField(choices=ProviderEnum.get_names() + ["unknown"]),
        required=False,
    )
    sort = rest_serializers.CharField(required=False, allow_null=True)

    def validate_provider(self, value: list[str]) -> list[int | None]:
        return [(PROVIDER_MAP[provider] if provider != "unknown" else None) for provider in value]

    # Support camel case since it's used by our response serializer.
    def validate_sort(self, value: str | None) -> str | None:
        if value is None:
            return None

        value_str: str = camel_to_snake_case(value)  # new var for mypy
        if not value_str.startswith("-") and value_str not in SORT_FIELDS:
            raise ParseError(detail=f"Invalid sort: {value}")
        if value_str.startswith("-") and value_str[1:] not in SORT_FIELDS:
            raise ParseError(detail=f"Invalid sort: {value_str[1:]}")
        return value_str


@cell_silo_endpoint
@extend_schema(tags=["Flags"])
class OrganizationFlagLogIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.FLAG
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @extend_schema(
        operation_id="listOrganizationFlagLogs",
        summary="List an Organization's Flag Logs",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.START,
            GlobalParams.END,
            GlobalParams.STATS_PERIOD,
            FlagParams.FLAG,
            FlagParams.PROVIDER,
            FlagParams.SORT,
            VisibilityParams.PER_PAGE,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer("ListFlagLogsResponse", FlagLogIndexResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
        },
        examples=FlagExamples.LIST_FLAG_LOGS,
    )
    def get(self, request: Request, organization: Organization) -> Response[FlagLogIndexResponse]:
        """
        Return a paginated list of feature flag changes (creations, updates and deletions)
        recorded for an organization within the requested time range.
        """
        start, end = get_date_range_from_params(request.GET)
        if start is None or end is None:
            raise ParseError(detail="Invalid date range")

        validator = FlagLogIndexRequestSerializer(
            data={
                **request.GET.dict(),
                "flag": request.GET.getlist("flag"),
                "provider": request.GET.getlist("provider"),
            }
        )
        if not validator.is_valid():
            raise ParseError(detail=validator.errors)
        query_params = validator.validated_data

        queryset = FlagAuditLogModel.objects.filter(
            created_at__gte=start,
            created_at__lt=end,
            organization_id=organization.id,
        )

        if flags := query_params.get("flag"):
            queryset = queryset.filter(flag__in=flags)

        if providers := query_params.get("provider"):
            filter = Q(provider__in=providers)
            if None in providers:
                filter |= Q(provider__isnull=True)
            queryset = queryset.filter(filter)

        if sort := query_params.get("sort"):
            queryset = queryset.order_by(sort)

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: {
                "data": serialize(x, request.user, FlagAuditLogModelSerializer())
            },
            paginator_cls=OffsetPaginator,
        )


@cell_silo_endpoint
@extend_schema(tags=["Flags"])
class OrganizationFlagLogDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.FLAG
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @extend_schema(
        operation_id="retrieveOrganizationFlagLog",
        summary="Retrieve an Organization's Flag Log",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, FlagParams.FLAG_LOG_ID],
        responses={
            200: inline_sentry_response_serializer("GetFlagLogResponse", FlagLogDetailsResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=FlagExamples.GET_FLAG_LOG,
    )
    def get(
        self, request: Request, organization: Organization, flag_log_id: int
    ) -> Response[FlagLogDetailsResponse]:
        """
        Return a single feature flag change recorded for an organization.
        """
        try:
            model = FlagAuditLogModel.objects.filter(
                id=flag_log_id,
                organization_id=organization.id,
            ).get()
        except FlagAuditLogModel.DoesNotExist:
            raise ResourceDoesNotExist

        return self.respond({"data": serialize(model, request.user, FlagAuditLogModelSerializer())})
