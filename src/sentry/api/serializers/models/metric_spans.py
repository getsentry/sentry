from sentry.api.serializers import Serializer


class MetricSpansSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)

    def _compute_attrs(self, item):
        return [span.__dict__ for span in item.spans]

    def get_attrs(self, item_list, user):
        return {item: self._compute_attrs(item) for item in item_list}

    def _serialize_span_payload(self, span_payload):
        return {
            "projectId": span_payload.get("project_id"),
            "spanId": span_payload.get("span_id"),
            "traceId": span_payload.get("trace_id"),
            "transactionId": span_payload.get("transaction_id"),
            "profileId": span_payload.get("profile_id"),
            "duration": span_payload.get("duration"),
        }

    def serialize(self, obj, attrs, user):
        return [self._serialize_span_payload(span) for span in attrs]
