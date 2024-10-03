from datetime import datetime
from typing import Any, TypedDict

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.utils import get_date_range_from_params
from sentry.flags.models import ActionEnum, CreatedByTypeEnum, FlagAuditLogModel
from sentry.models.organization import Organization


class FlagAuditLogModelSerializerResponse(TypedDict):
    id: int
    action: str
    created_at: datetime
    created_by: str
    created_by_type: str
    flag: str
    tags: dict[str, Any]


@register(FlagAuditLogModel)
class FlagAuditLogModelSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> FlagAuditLogModelSerializerResponse:
        return {
            "id": obj.id,
            "action": ActionEnum.to_string(obj.action),
            "created_at": obj.created_at.isoformat(),
            "created_by": obj.created_by,
            "created_by_type": CreatedByTypeEnum.to_string(obj.created_by_type),
            "flag": obj.flag,
            "tags": obj.tags,
        }


@region_silo_endpoint
class OrganizationFlagLogIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.FLAG
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:feature-flag-ui", organization, actor=request.user):
            raise ResourceDoesNotExist

        start, end = get_date_range_from_params(request.GET)
        if start is None or end is None:
            raise ParseError(detail="Invalid date range")

        queryset = FlagAuditLogModel.objects.filter(
            created_at__gte=start,
            created_at__lt=end,
            organization_id=organization.id,
        )

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
        if not features.has("organizations:feature-flag-ui", organization, actor=request.user):
            raise ResourceDoesNotExist

        try:
            model = FlagAuditLogModel.objects.filter(
                id=flag_log_id,
                organization_id=organization.id,
            ).first()
        except FlagAuditLogModel.DoesNotExist:
            raise ResourceDoesNotExist

        return self.respond({"data": serialize(model, request.user, FlagAuditLogModelSerializer())})
