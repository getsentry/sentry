import re
from typing import Dict, Generic, List, Optional, TypeVar

import sentry_sdk
from sentry_sdk.envelope import Envelope, Item

from minimetrics.types import ExtractedMetric, ExtractedMetricValue, MetricTagsInternal, MetricUnit
from minimetrics.utils import is_ascii_control
from sentry.utils import metrics

IN = TypeVar("IN")
OUT = TypeVar("OUT")
M = TypeVar("M")


class EncodingError(Exception):
    pass


class MetricEnvelopeEncoder(Generic[IN, OUT]):
    def encode(self, value: IN) -> OUT:
        raise NotImplementedError()


class RelayStatsdEncoder(MetricEnvelopeEncoder[ExtractedMetric, str]):
    MULTI_VALUE_SEPARATOR = ":"
    TAG_SEPARATOR = ","

    def encode(self, value: ExtractedMetric) -> str:
        metric_name = value["name"]
        if not self._validate_metric_name(metric_name):
            raise EncodingError("The metric name is not valid")
        metric_unit = self._get_metric_unit(value.get("unit"))
        metric_value = self._get_metric_value(value["value"])
        metric_type = value["type"]
        metric_tags = self._get_metric_tags(value.get("tags"))
        metric_timestamp = self._get_metric_timestamp(value["timestamp"])

        return f"{metric_name}{metric_unit}:{metric_value}|{metric_type}{metric_tags}{metric_timestamp}"

    @classmethod
    def _validate_metric_name(cls, metric_name: str) -> bool:
        # Metric names cannot be empty
        if not metric_name:
            return False

        # Metric names must begin with a letter
        if not metric_name[0].isalpha():
            return False

        # Metric names can consist of ASCII alphanumerics, underscores, slashes, and periods
        pattern = r"^[a-zA-Z0-9_/\.]+$"
        return bool(re.match(pattern, metric_name))

    @classmethod
    def _validate_tag_key(cls, tag_key: str):
        # Check if the tag key contains any ASCII control characters.
        if any(is_ascii_control(char) for char in tag_key):
            return False

        return True

    @classmethod
    def _validate_tag_value(cls, tag_key: str) -> str:
        # Remove control characters from the tag key
        return "".join(char for char in tag_key if not is_ascii_control(char))

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

        # We first filter all tags that have an invalid key. Out of the valid keys, we sanitize the tag values by
        # removing unwanted chars.
        filtered_tags = (
            (tag_key, cls._validate_tag_value(tag_value))
            for tag_key, tag_value in tags
            if cls._validate_tag_key(tag_key)
        )
        # We then convert all tag values that are not empty into the string protocol representation.
        tags_as_string = cls.TAG_SEPARATOR.join(
            [f"{tag_key}:{tag_value}" for tag_key, tag_value in filtered_tags if tag_value]
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
