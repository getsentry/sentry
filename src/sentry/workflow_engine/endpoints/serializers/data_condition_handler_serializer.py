from collections.abc import Mapping
from typing import Any, NotRequired, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.workflow_engine.types import DataConditionHandler


class DataConditionHandlerResponse(TypedDict):
    type: str
    handlerGroup: str
    handlerSubgroup: NotRequired[str]
    comparisonJsonSchema: dict[str, Any]


@register(DataConditionHandler)
class DataConditionHandlerSerializer(Serializer):
    def serialize(
        self,
        obj: DataConditionHandler[Any],
        attrs: Mapping[str, Any],
        user: Any,
        **kwargs: Any,
    ) -> DataConditionHandlerResponse:
        condition_type = kwargs.get("condition_type")
        if condition_type is None:
            raise ValueError("condition_type is required")
        result: DataConditionHandlerResponse = {
            "type": condition_type,
            "handlerGroup": obj.group.value,
            "comparisonJsonSchema": obj.comparison_json_schema,
        }
        if hasattr(obj, "subgroup"):
            result["handlerSubgroup"] = obj.subgroup.value
        return result
