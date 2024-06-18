from sentry.api.serializers import Serializer


class MetricsExtractionRuleSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)

    def get_attrs(self, item_list, user):
        return {item: item.__dict__ for item in item_list}

    def serialize(self, obj, attrs, user):
        return {
            "spanAttribute": attrs.get("span_attribute"),
            "type": attrs.get("type"),
            "unit": attrs.get("unit"),
            "tags": list(attrs.get("tags") or set()),
            "conditions": list(attrs.get("conditions") or set()),
        }
