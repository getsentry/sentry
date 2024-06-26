from typing import Any

from sentry.api.serializers import Serializer
from sentry.sentry_metrics.models import SpanAttributeExtractionRuleConfig


class MetricsExtractionRuleSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)

    def serialize(self, obj, attrs, user):
        return {
            "spanAttribute": attrs.get("span_attribute"),
            "type": attrs.get("type"),
            "unit": attrs.get("unit"),
            "tags": list(attrs.get("tags") or set()),
            "conditions": list(attrs.get("conditions") or set()),
            "id": attrs.get("id"),
        }


class SpanAttributeExtractionRuleConfigSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)

    def serialize(self, obj, attrs, user):
        return {
            "spanAttribute": obj.span_attribute,
            "aggregates": list(obj.aggregates),
            "unit": obj.unit,
            "tags": list(obj.tags),
            "conditions": self._serialize_conditions(obj),
        }

    def _serialize_conditions(self, obj: SpanAttributeExtractionRuleConfig) -> list[dict[str, Any]]:
        return [
            {"id": condition.id, "value": condition.value, "mris": condition.generate_mris()}
            for condition in obj.conditions.all()
        ]
