import time
from typing import Dict, Generic, List, Optional, TypeVar

import sentry_sdk
from sentry_sdk.envelope import Envelope, Item

from minimetrics.types import ExtractedMetric, ExtractedMetricValue, MetricTagsInternal, MetricUnit

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
        metric_name = value["name"]
        metric_unit = self._get_metric_unit(value.get("unit"))
        metric_value = self._get_metric_value(value["value"])
        metric_type = value["type"]
        metric_tags = self._get_tags(value.get("tags"))

        return f"{metric_name}{metric_unit}:{metric_value}|{metric_type}{metric_tags}"

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
    def _get_tags(cls, tags: Optional[MetricTagsInternal]) -> str:
        if not tags:
            return ""

        tags = cls.TAG_SEPARATOR.join([f"{tag_key}:{tag_value}" for tag_key, tag_value in tags])
        return f"|#{tags}"


class MetricEnvelopeTransport(Generic[M]):
    def __init__(self, encoder: MetricEnvelopeEncoder[M, str]):
        self._client = sentry_sdk.Hub.current.client
        self._encoder = encoder

    def send(self, metric: M):
        if self._client is None:
            return

        metric_item = Item(
            payload=self._encoder.encode(metric),
            type="statsd",
            content_type="text",
            headers={"timestamp": int(time.time())},
        )

        self._client.transport.capture_envelope(
            Envelope(
                headers=None,
                items=[metric_item],
            )
        )
