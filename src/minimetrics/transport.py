import time
from typing import Generic, TypeVar

import sentry_sdk
from sentry_sdk.envelope import Envelope, Item

from minimetrics.core import ExtractedMetric

IN = TypeVar("IN")
OUT = TypeVar("OUT")
M = TypeVar("M")


class MetricEnvelopeEncoder(Generic[IN, OUT]):
    def encode(self, value: IN) -> OUT:
        raise NotImplementedError()


class DogstatsdEncoder(MetricEnvelopeEncoder[ExtractedMetric, str]):
    def encode(self, value: ExtractedMetric) -> str:
        return "encoded"


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
