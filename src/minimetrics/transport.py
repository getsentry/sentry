import re
from typing import Dict, Generic, List, Optional, TypeVar

import sentry_sdk
from sentry_sdk.envelope import Envelope, Item

from minimetrics.types import ExtractedMetric, ExtractedMetricValue, MetricTagsInternal, MetricUnit
from sentry.utils import metrics

IN = TypeVar("IN")
OUT = TypeVar("OUT")
M = TypeVar("M")

sanitization_re = re.compile(r"[^a-zA-Z0-9_/.]+")


class EncodingError(Exception):
    pass


class MetricEnvelopeEncoder(Generic[IN, OUT]):
    def encode(self, value: IN) -> OUT:
        raise NotImplementedError()


class RelayStatsdEncoder(MetricEnvelopeEncoder[ExtractedMetric, str]):
    MULTI_VALUE_SEPARATOR = ":"
    TAG_SEPARATOR = ","

    def encode(self, value: ExtractedMetric) -> str:
        metric_name = self._sanitize_value(value["name"])
        if not metric_name:
            raise EncodingError("The sanitized metric name is empty")
        metric_unit = self._get_metric_unit(value.get("unit"))
        metric_value = self._get_metric_value(value["value"])
        metric_type = value["type"]
        metric_tags = self._get_metric_tags(value.get("tags"))
        metric_timestamp = self._get_metric_timestamp(value["timestamp"])

        return f"{metric_name}{metric_unit}:{metric_value}|{metric_type}{metric_tags}{metric_timestamp}"

    @staticmethod
    def _sanitize_value(value: str) -> str:
        # Remove all non-alphanumerical chars which are different from _ / .
        return sanitization_re.sub("", value)

    @classmethod
    def _get_metric_unit(cls, unit: Optional[MetricUnit]) -> str:
        if unit is None:
            return ""

        return f"@{unit}"

    @classmethod
    def _get_metric_value(cls, value: ExtractedMetricValue) -> str:
        if isinstance(value, (int, float)):
            return str(value)
        elif isinstance(value, List):
            return cls.MULTI_VALUE_SEPARATOR.join([str(v) for v in value])
        elif isinstance(value, Dict):
            return cls.MULTI_VALUE_SEPARATOR.join([str(v) for v in value.values()])

        raise Exception("The metric value must be either a float or a list of floats")

    @classmethod
    def _get_metric_tags(cls, tags: Optional[MetricTagsInternal]) -> str:
        if not tags:
            return ""

        # We first filter all tags whose sanitized tag key is empty and we also sanitize all tag values. Note that empty
        # tag values are possible.
        filtered_tags = (
            (cls._sanitize_value(tag_key), cls._sanitize_value(tag_value))
            for tag_key, tag_value in tags
            if cls._sanitize_value(tag_key)
        )
        # We then convert all tag values that are not empty into the string protocol representation.
        tags_as_string = cls.TAG_SEPARATOR.join(
            [f"{tag_key}:{tag_value}" for tag_key, tag_value in filtered_tags]
        )
        return f"|#{tags_as_string}"

    @classmethod
    def _get_metric_timestamp(cls, timestamp: int) -> str:
        return f"|T{timestamp}"


class MetricEnvelopeTransport(Generic[M]):
    def __init__(self, encoder: MetricEnvelopeEncoder[M, str]):
        self._encoder = encoder

    def send(self, metric: M):
        client = sentry_sdk.Hub.current.client
        if client is None:
            return

        try:
            encoded_metric = self._encoder.encode(metric)
        except EncodingError:
            return

        metric_item = Item(payload=encoded_metric, type="statsd")
        envelope = Envelope(
            headers=None,
            items=[metric_item],
        )
        self._track_envelope_size(envelope)

        transport = client.transport
        if transport is not None:
            transport.capture_envelope(envelope)

    @staticmethod
    def _track_envelope_size(envelope: Envelope):
        envelope_size = len(envelope.serialize())
        metrics.timing(key="minimetrics.envelope_size", value=envelope_size, sample_rate=1.0)
