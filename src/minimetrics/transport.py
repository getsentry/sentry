import re
import sys
from typing import Generator, Optional, Sequence

import sentry_sdk
from sentry_sdk.envelope import Envelope, Item

from minimetrics.types import FlushedMetric, FlushedMetricValue, MetricTagsInternal, MetricUnit
from sentry.utils import metrics

sanitization_re = re.compile(r"[^a-zA-Z0-9_/.]+")


class EncodingError(Exception):
    pass


class RelayStatsdEncoder:
    MULTI_VALUE_SEPARATOR = ":"
    TAG_SEPARATOR = ","

    def encode(self, value: FlushedMetric) -> str:
        metric_name = self._sanitize_value(value.bucket_key.metric_name)
        if not metric_name:
            raise EncodingError(
                f"The sanitized metric name {value.bucket_key.metric_name} is empty"
            )
        metric_unit = self._get_metric_unit(value.bucket_key.metric_unit)
        metric_values = self._get_metric_values(value.metric.serialize_value())
        metric_type = value.bucket_key.metric_type
        metric_tags = self._get_metric_tags(value.bucket_key.metric_tags)
        metric_timestamp = self._get_metric_timestamp(value.bucket_key.timestamp)

        return f"{metric_name}{metric_unit}:{metric_values}|{metric_type}{metric_tags}{metric_timestamp}"

    def encode_multiple(self, values: Sequence[FlushedMetric]) -> str:
        def _safe_encode(value: FlushedMetric) -> Optional[str]:
            try:
                return self.encode(value)
            except EncodingError:
                sentry_sdk.capture_exception()
                return None

        return "\n".join(
            encoded_value for value in values if (encoded_value := _safe_encode(value))
        )

    def _sanitize_value(self, value: str) -> str:
        # Remove all non-alphanumerical chars which are different from _ / .
        return sanitization_re.sub("", value)

    def _get_metric_unit(self, unit: MetricUnit) -> str:
        return f"@{unit}"

    def _get_metric_values(self, value: Generator[FlushedMetricValue, None, None]) -> str:
        return self.MULTI_VALUE_SEPARATOR.join(str(v) for v in value)

    def _get_metric_tags(self, tags: Optional[MetricTagsInternal]) -> str:
        if not tags:
            return ""

        # We sanitize all the tag keys and tag values.
        sanitized_tags = (
            (self._sanitize_value(tag_key), self._sanitize_value(tag_value))
            for tag_key, tag_value in tags
        )
        # We then convert all tags whose tag key is not empty to the string representation.
        tags_as_string = self.TAG_SEPARATOR.join(
            f"{tag_key}:{tag_value}" for tag_key, tag_value in sanitized_tags if tag_key
        )
        return f"|#{tags_as_string}"

    def _get_metric_timestamp(self, timestamp: int) -> str:
        return f"|T{timestamp}"


class MetricEnvelopeTransport:
    def __init__(self, encoder: RelayStatsdEncoder):
        self._encoder = encoder

    def send(self, flushed_metrics: Sequence[FlushedMetric]):
        client = sentry_sdk.Hub.current.client
        if client is None:
            return

        transport = client.transport
        if transport is None:
            return

        encoded_metrics = self._encoder.encode_multiple(flushed_metrics)
        metric_item = Item(payload=encoded_metrics, type="statsd")
        envelope = Envelope(
            headers=None,
            items=[metric_item],
        )

        self._track_envelope_size(envelope)
        transport.capture_envelope(envelope)

    def _track_envelope_size(self, envelope: Envelope):
        envelope_size = sys.getsizeof(envelope)
        metrics.timing(key="minimetrics.envelope_size", value=envelope_size, sample_rate=1.0)
