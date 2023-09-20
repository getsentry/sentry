import re
from functools import partial
from io import BytesIO
from typing import Dict, Iterable, List, Tuple

import sentry_sdk
from sentry_sdk.envelope import Envelope, Item

from minimetrics.types import FlushableBuckets, FlushableMetric, MetricType
from sentry import options
from sentry.utils import metrics


class EncodingError(Exception):
    """
    Raised when the encoding of a flushed metric encounters an error.
    """

    pass


sanitize_value = partial(re.compile(r"[^a-zA-Z0-9_/.]").sub, "")


class RelayStatsdEncoder:
    def _encode(self, value: FlushableMetric, out: BytesIO):
        _write = out.write
        timestamp, (metric_type, metric_name, metric_unit, metric_tags), metric = value
        metric_name = sanitize_value(metric_name) or "invalid-metric-name"
        _write(f"{metric_name}@{metric_unit}".encode())

        for serialized_value in metric.serialize_value():
            _write(b":")
            _write(str(serialized_value).encode("utf-8"))

        _write(f"|{metric_type}".encode("ascii"))

        if metric_tags:
            _write(b"|#")
            first = True
            for tag_key, tag_value in metric_tags:
                tag_key = sanitize_value(tag_key)
                if not tag_key:
                    continue
                if first:
                    first = False
                else:
                    _write(b",")
                _write(tag_key.encode("utf-8"))
                _write(b":")
                _write(sanitize_value(tag_value).encode("utf-8"))

        _write(f"|T{timestamp}".encode("ascii"))

    def encode_multiple(self, values: Iterable[FlushableMetric]) -> bytes:
        out = BytesIO()
        _write = out.write

        for value in values:
            self._encode(value, out)
            _write(b"\n")

        return out.getvalue()


class MetricEnvelopeTransport:
    def __init__(self, encoder: RelayStatsdEncoder):
        self._encoder = encoder

    def send(self, flushable_buckets: FlushableBuckets):
        client = sentry_sdk.Hub.current.client
        if client is None:
            return

        transport = client.transport
        if transport is None:
            return

        flushable_metrics: List[FlushableMetric] = []
        stats_by_type: Dict[MetricType, Tuple[int, int]] = {}
        for buckets_timestamp, buckets in flushable_buckets:
            for bucket_key, metric in buckets.items():
                flushable_metric: FlushableMetric = (buckets_timestamp, bucket_key, metric)
                flushable_metrics.append(flushable_metric)
                (prev_buckets_count, prev_buckets_weight) = stats_by_type.get(bucket_key[0], (0, 0))
                stats_by_type[bucket_key[0]] = (
                    prev_buckets_count + 1,
                    prev_buckets_weight + metric.weight,
                )

        for metric_type, (buckets_count, buckets_weight) in stats_by_type.items():
            # We want to emit a metric on how many buckets and weight there was for a metric type.
            metrics.timing(
                key="minimetrics.flushed_buckets",
                value=buckets_count,
                tags={"metric_type": metric_type},
                sample_rate=1.0,
            )
            metrics.incr(
                key="minimetrics.flushed_buckets_counter",
                amount=buckets_count,
                tags={"metric_type": metric_type},
                sample_rate=1.0,
            )
            metrics.timing(
                key="minimetrics.flushed_buckets_weight",
                value=buckets_weight,
                tags={"metric_type": metric_type},
                sample_rate=1.0,
            )
            metrics.incr(
                key="minimetrics.flushed_buckets_weight_counter",
                amount=buckets_weight,
                tags={"metric_type": metric_type},
                sample_rate=1.0,
            )

        if options.get("delightful_metrics.enable_envelope_serialization"):
            encoded_metrics = self._encoder.encode_multiple(flushable_metrics)
            metrics.timing(
                key="minimetrics.encoded_metrics_size", value=len(encoded_metrics), sample_rate=1.0
            )
            metric_item = Item(payload=encoded_metrics, type="statsd")
            envelope = Envelope(
                headers=None,
                items=[metric_item],
            )

            if options.get("delightful_metrics.enable_capture_envelope"):
                transport.capture_envelope(envelope)
