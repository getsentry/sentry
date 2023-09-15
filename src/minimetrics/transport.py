import re
from functools import partial
from typing import Iterable

import sentry_sdk
from sentry_sdk.envelope import Envelope, Item

from minimetrics.types import FlushedMetric, MetricTagsInternal
from sentry.utils import metrics


class EncodingError(Exception):
    """
    Raised when the encoding of a flushed metric encounters an error.
    """

    pass


sanitize_value = partial(re.compile(r"[^a-zA-Z0-9_/.]").sub, "")


class RelayStatsdEncoder:
    def encode(self, value: FlushedMetric) -> str:
        (timestamp, metric_type, metric_name, metric_unit, metric_tags), metric = value
        metric_name = sanitize_value(metric_name) or "invalid-metric-name"
        metric_values = ":".join(str(v) for v in metric.serialize_value())
        serialized_metric_tags = self._get_metric_tags(metric_tags)
        metric_tags_prefix = serialized_metric_tags and "|#" or ""
        return f"{metric_name}@{metric_unit}:{metric_values}|{metric_type}{metric_tags_prefix}{serialized_metric_tags}|T{timestamp}"

    def encode_multiple(self, values: Iterable[FlushedMetric]) -> str:
        return "\n".join(self.encode(value) for value in values)

    def _get_metric_tags(self, tags: MetricTagsInternal) -> str:
        if not tags:
            return ""

        # We sanitize all the tag keys and tag values.
        sanitized_tags = (
            (sanitize_value(tag_key), sanitize_value(tag_value)) for tag_key, tag_value in tags
        )

        # We then convert all tags whose tag key is not empty to the string representation.
        return ",".join(
            f"{tag_key}:{tag_value}" for tag_key, tag_value in sanitized_tags if tag_key
        )


class MetricEnvelopeTransport:
    def __init__(self, encoder: RelayStatsdEncoder):
        self._encoder = encoder

    def send(self, flushed_metrics: Iterable[FlushedMetric]):
        client = sentry_sdk.Hub.current.client
        if client is None:
            return

        transport = client.transport
        if transport is None:
            return

        encoded_metrics = self._encoder.encode_multiple(flushed_metrics)
        metrics.timing(
            key="minimetrics.encoded_metrics_size", value=len(encoded_metrics), sample_rate=1.0
        )

        metric_item = Item(payload=encoded_metrics, type="statsd")
        envelope = Envelope(
            headers=None,
            items=[metric_item],
        )
        transport.capture_envelope(envelope)
