import re
from typing import Dict, Generic, List, Optional, TypeVar

import sentry_sdk
from sentry_sdk.envelope import Envelope, Item

from minimetrics.types import ExtractedMetric, ExtractedMetricValue, MetricTagsInternal, MetricUnit
from sentry.utils import metrics

IN = TypeVar("IN")
OUT = TypeVar("OUT")
M = TypeVar("M")


class MetricEnvelopeEncoder(Generic[IN, OUT]):
    def encode(self, value: IN) -> OUT:
        raise NotImplementedError()


class RelayStatsdEncoder(MetricEnvelopeEncoder[ExtractedMetric, str]):
    MULTI_VALUE_SEPARATOR = ":"
    TAG_SEPARATOR = ","

    def encode(self, value: ExtractedMetric) -> str:
        metric_name = self._sanitize_str(value["name"])
        metric_unit = self._get_metric_unit(value.get("unit"))
        metric_value = self._get_metric_value(value["value"])
        metric_type = value["type"]
        metric_tags = self._get_metric_tags(value.get("tags"))
        metric_timestamp = self._get_metric_timestamp(value["timestamp"])

        return f"{metric_name}{metric_unit}:{metric_value}|{metric_type}{metric_tags}{metric_timestamp}"

    @classmethod
    def _sanitize_str(cls, value: str) -> str:
        # TODO: implement input sanitization.
        pattern = re.compile(r"[:@,#|]")
        return pattern.sub("", value)

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

        tags_as_string = cls.TAG_SEPARATOR.join(
            [
                f"{cls._sanitize_str(tag_key)}:{cls._sanitize_str(tag_value)}"
                for tag_key, tag_value in tags
            ]
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

        metric_item = Item(payload=self._encoder.encode(metric), type="statsd")
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
