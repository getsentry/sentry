from datetime import datetime
from typing import Any, TypedDict

from django.core.exceptions import FieldError
from django.db.models import Q
from rest_framework import serializers as rest_serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.rest_framework.base import camel_to_snake_case
from sentry.api.utils import get_date_range_from_params
from sentry.flags.models import (
    PROVIDER_MAP,
    ActionEnum,
    CreatedByTypeEnum,
    FlagAuditLogModel,
    ProviderEnum,
)
from sentry.models.organization import Organization


class FlagAuditLogModelSerializerResponse(TypedDict):
    id: int
    action: str
    createdAt: datetime
    createdBy: str | None
    createdByType: str | None
    flag: str
    provider: str | None
    tags: dict[str, Any]


@register(FlagAuditLogModel)
class FlagAuditLogModelSerializer(Serializer):
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
        return camel_to_snake_case(value) if value else None


@region_silo_endpoint
class OrganizationFlagLogIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.FLAG
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization) -> Response:
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
            try:
                queryset = queryset.order_by(sort)
            except FieldError:
                raise ParseError(detail=f"Invalid sort: {sort}")

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: {
                "data": serialize(x, request.user, FlagAuditLogModelSerializer())
            },
            paginator_cls=OffsetPaginator,
        )


@region_silo_endpoint
class OrganizationFlagLogDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.FLAG
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization, flag_log_id: int) -> Response:
        try:
            model = FlagAuditLogModel.objects.filter(
                id=flag_log_id,
                organization_id=organization.id,
            ).get()
        except FlagAuditLogModel.DoesNotExist:
            raise ResourceDoesNotExist

        return self.respond({"data": serialize(model, request.user, FlagAuditLogModelSerializer())})
