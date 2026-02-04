from typing import Any

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.workflow_engine.models import DataCondition


@register(DataCondition)
class DataConditionSerializer(Serializer):
    def serialize(self, obj: DataCondition, *args: Any, **kwargs: Any) -> dict[str, Any]:
        comparison = obj.comparison
        if isinstance(comparison, dict):
            comparison = convert_dict_key_case(obj.comparison, snake_to_camel_case)

        return {
            "id": str(obj.id),
            "type": obj.type,
            "comparison": comparison,
            "conditionResult": obj.condition_result,
        }
