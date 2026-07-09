from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.explore.models import (
    TraceItemAttributeContext,
    TraceItemAttributeTypes,
    TraceItemTypes,
)


class TraceItemAttributeContextResponse(TypedDict):
    id: str
    attributeKey: str
    dataset: str | None
    attributeType: str | None
    project: str | None
    brief: str | None
    additionalContext: str | None
    examples: list[str]
    dateCreated: datetime
    dateUpdated: datetime


@register(TraceItemAttributeContext)
class TraceItemAttributeContextSerializer(Serializer):
    def serialize(
        self, obj: TraceItemAttributeContext, attrs: Any, user: Any, **kwargs: Any
    ) -> TraceItemAttributeContextResponse:
        return {
            "id": str(obj.id),
            "attributeKey": obj.attribute_key,
            "dataset": TraceItemTypes.get_type_name(obj.item_type),
            "attributeType": TraceItemAttributeTypes.get_type_name(obj.attribute_type),
            "project": str(obj.project_id) if obj.project_id else None,
            "brief": obj.brief,
            "additionalContext": obj.additional_context,
            "examples": obj.examples,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
