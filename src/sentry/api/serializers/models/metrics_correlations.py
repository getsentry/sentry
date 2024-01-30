from sentry.api.serializers import Serializer


class MetricCorrelationsSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)

    def _compute_attrs(self, item):
        return [segment.__dict__ for segment in item.segments]

    def get_attrs(self, item_list, user):
        return {item: self._compute_attrs(item) for item in item_list}

    def _serialize_metric_summaries(self, metric_summaries):
        return [
            {
                "spanId": metric_summary.span_id,
                "min": metric_summary.min,
                "max": metric_summary.max,
                "sum": metric_summary.sum,
                "count": metric_summary.count,
            }
            for metric_summary in metric_summaries
        ]

    def _serialize_spans_details_payload(self, spans_details):
        return [
            {
                "spanId": span_details.span_id,
                "spanDuration": span_details.span_duration,
                "spanTimestamp": span_details.span_timestamp,
            }
            for span_details in spans_details
        ]

    def _serialize_spans_summary_payload(self, spans_summary):
        return [
            {"spanOp": span_summary.span_op, "spanDuration": span_summary.total_duration}
            for span_summary in spans_summary
        ]

    def _serialize_segment_payload(self, segment_payload):
        return {
            "projectId": segment_payload.get("project_id"),
            "transactionId": segment_payload.get("segment_id"),
            "transactionSpanId": segment_payload.get("segment_span_id"),
            "traceId": segment_payload.get("trace_id"),
            "profileId": segment_payload.get("profile_id"),
            "segmentName": segment_payload.get("segment_name"),
            "spansNumber": segment_payload.get("spans_number"),
            "metricSummaries": self._serialize_metric_summaries(
                segment_payload.get("metric_summaries", [])
            ),
            "spansDetails": self._serialize_spans_details_payload(
                segment_payload.get("spans_details", [])
            ),
            "spansSummary": self._serialize_spans_summary_payload(
                segment_payload.get("spans_summary", [])
            ),
            "duration": segment_payload.get("duration"),
            "timestamp": segment_payload.get("timestamp"),
        }

    def serialize(self, obj, attrs, user):
        return [self._serialize_segment_payload(span) for span in attrs]
