from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.explore.models import (
    TraceItemAttributeValueContext,
    TraceItemTypes,
    TraceMetricTypes,
)


class TraceItemAttributeValueContextResponse(TypedDict):
    id: str
    attributeName: str
    attributeValue: str
    dataset: str | None
    attributeType: str | None
    project: str | None
    brief: str | None
    additionalContext: str | None
    dateCreated: datetime
    dateUpdated: datetime


@register(TraceItemAttributeValueContext)
class TraceItemAttributeValueContextSerializer(Serializer):
    def serialize(
        self, obj: TraceItemAttributeValueContext, attrs: Any, user: Any, **kwargs: Any
    ) -> TraceItemAttributeValueContextResponse:
        return {
            "id": str(obj.id),
            "attributeName": obj.attribute_name,
            "attributeValue": obj.attribute_value,
            "dataset": TraceItemTypes.get_type_name(obj.item_type),
            "attributeType": TraceMetricTypes.get_type_name(obj.attribute_type),
            "project": str(obj.project_id) if obj.project_id else None,
            "brief": obj.brief,
            "additionalContext": obj.additional_context,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
