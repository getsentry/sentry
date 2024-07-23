from sentry.api.serializers import Serializer


class MetricBlockingSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)

    def get_attrs(self, item_list, user, **kwargs):
        return {item: item.__dict__ for item in item_list}

    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "metricMri": attrs.get("metric_mri"),
            "isBlocked": attrs.get("is_blocked"),
            "blockedTags": list(attrs.get("blocked_tags") or set()),
        }
