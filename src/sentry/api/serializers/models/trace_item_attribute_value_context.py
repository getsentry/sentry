from collections.abc import Mapping
from datetime import datetime
from typing import TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.explore.models import (
    TraceItemAttributeValueContext,
    TraceItemTypes,
    TraceMetricTypes,
)
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class TraceItemAttributeValueContextResponse(TypedDict):
    id: str
    attributeName: str
    attributeValue: str
    dataset: str | None
    attributeType: str | None
    brief: str | None
    additionalContext: str | None
    dateCreated: datetime
    dateUpdated: datetime


@register(TraceItemAttributeValueContext)
class TraceItemAttributeValueContextSerializer(Serializer):
    def serialize(
        self,
        obj: TraceItemAttributeValueContext,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> TraceItemAttributeValueContextResponse:
        return {
            "id": str(obj.id),
            "attributeName": obj.attribute_name,
            "attributeValue": obj.attribute_value,
            "dataset": TraceItemTypes.get_type_name(obj.item_type),
            "attributeType": TraceMetricTypes.get_type_name(obj.attribute_type),
            "brief": obj.brief,
            "additionalContext": obj.additional_context,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
