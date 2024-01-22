from sentry.api.serializers import Serializer


class BlockedMetricsSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)

    def _compute_attrs(self, item):
        return [blocked_metric.__dict__ for blocked_metric in item.metrics]

    def get_attrs(self, item_list, user):
        return {item: self._compute_attrs(item) for item in item_list}

    def _serialize_segment_payload(self, segment_payload):
        return {
            "metricMri": segment_payload.get("metric_mri"),
            "tags": segment_payload.get("tags", []),
        }

    def serialize(self, obj, attrs, user):
        return [self._serialize_segment_payload(span) for span in attrs]
