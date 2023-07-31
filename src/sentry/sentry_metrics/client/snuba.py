from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping, Optional, Sequence, Union

import urllib3
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic, Value
from django.core.cache import cache

from sentry import quotas
from sentry.sentry_metrics.client.base import GenericMetricsBackend
from sentry.sentry_metrics.configuration import IndexerStorage, UseCaseKey, get_ingest_config
from sentry.sentry_metrics.consumers.indexer.processing import MessageProcessor
from sentry.sentry_metrics.consumers.indexer.routing_producer import RoutingPayload
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils import json, snuba

# ingest_codec: sentry_kafka_schemas.codecs.Codec[Any] = sentry_kafka_schemas.get_codec(
#     "ingest-metrics"
# )

_METRIC_TYPE_TO_ENTITY: Mapping[str, str] = {
    "c": "generic_metrics_counters",
    "s": "generic_metrics_sets",
    "d": "generic_metrics_distributions",
}


_broker_timestamp = datetime.now() - datetime.timedelta(seconds=5)


def build_mri(metric_name: str, type: str, use_case_id: UseCaseID, unit: Optional[str]) -> str:
    mri_unit = "none" if unit is None else unit
    return f"{type}:{use_case_id.value}/{metric_name}@{mri_unit}"


def get_retention_from_org_id(org_id: int) -> int:
    cache_key = f"sentry_metrics:org_retention_days:{org_id}"
    cached_retention: Optional[int] = cache.get(cache_key)

    if cached_retention is not None:
        return cached_retention
    else:
        # the default in Snuba is 90 days, and if there is no
        # org-configured retention stored, we use that default
        retention = quotas.backend.get_event_retention(organization=org_id) or 90
        cache.set(cache_key, retention)

        return retention


# TODO: Use the Futures that are returned by the call to produce.
# These can be returned to the user, or handled in some way internally.
# Ensure all of the MetricsBackend implementations have the same
# Future return type.


class SnubaMetricsBackend(GenericMetricsBackend):
    def __init__(self) -> None:
        self._message_processor = MessageProcessor(
            get_ingest_config(UseCaseKey.PERFORMANCE, IndexerStorage.MOCK)
        )

    def counter(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Union[int, float],
        tags: Mapping[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Emit a counter metric for internal use cases only.
        Note that, as of now, this function will return
        immediately even if the metric message has not been
        produced to the broker yet.
        """

        # the message that the indexer receives
        counter_metric = {
            "org_id": org_id,
            "project_id": project_id,
            "name": build_mri(metric_name, "c", use_case_id, unit),
            "value": value,
            "timestamp": int(datetime.now().timestamp()),
            "tags": tags,
            "retention_days": get_retention_from_org_id(org_id),
            "type": "c",
        }

        self.__build_and_send_request(counter_metric)

    def set(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[int],
        tags: Mapping[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Emit a set metric for internal use cases only. Can support
        a sequence of values. Note that, as of now, this function
        will return immediately even if the metric message has not been
        produced to the broker yet.
        """

        set_metric = {
            "org_id": org_id,
            "project_id": project_id,
            "name": build_mri(metric_name, "s", use_case_id, unit),
            "value": value,
            "timestamp": int(datetime.now().timestamp()),
            "tags": tags,
            "retention_days": get_retention_from_org_id(org_id),
            "type": "s",
        }

        self.__build_and_send_request(set_metric)

    def distribution(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[Union[int, float]],
        tags: Mapping[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Emit a distribution metric for internal use cases only. Can
        support a sequence of values. Note that, as of now, this function
        will return immediately even if the metric message has not been
        produced to the broker yet.
        """
        dist_metric = {
            "org_id": org_id,
            "project_id": project_id,
            "name": build_mri(metric_name, "d", use_case_id, unit),
            "value": value,
            "timestamp": int(datetime.now().timestamp()),
            "tags": tags,
            "retention_days": get_retention_from_org_id(org_id),
            "type": "d",
        }

        self.__build_and_send_request(dist_metric)

    def __build_payload(self, metric) -> Sequence[Any]:
        # build message batch for the MessageProcessor
        message_batch = [
            Message(
                BrokerValue(
                    KafkaPayload(None, json.dumps(metric).encode("utf-8"), []),
                    Partition(Topic("topic"), 0),
                    0,
                    _broker_timestamp,
                )
            ),
        ]

        last = message_batch[-1]
        outer_message = Message(Value(message_batch, last.committable))

        # index message via the MessageProcessor
        new_batch = self._message_processor.process_messages(outer_message=outer_message)

        json_payloads = []
        for message in new_batch:
            payload = message.payload
            if type(payload) == RoutingPayload:
                payload = payload.routing_message
            # decode bytes into json
            json_payloads.append(payload.value.decode("utf-8"))

        return json_payloads

    def __build_and_send_request(self, metric):
        metric_type = metric["type"]
        headers = {}
        entity = _METRIC_TYPE_TO_ENTITY[metric_type]

        json_payloads = self.__build_payload(metric)
        payload = json_payloads[0]

        try:
            resp = snuba._snuba_pool.urlopen(
                "POST",
                f"/tests/{entity}/eventstream",
                body=payload,
                headers={f"X-Sentry-{k}": v for k, v in headers.items()},
            )
            if resp.status != 200:
                raise snuba.SnubaError(
                    f"HTTP {resp.status} response from Snuba! {json.loads(resp.data)}"
                )
            return None
        except urllib3.exceptions.HTTPError as err:
            raise snuba.SnubaError(err)

    def close(self) -> None:
        """
            Calling this is required once we are done emitting metrics
        using the current instance of the KafkaMetricsBackend
        """
        pass
