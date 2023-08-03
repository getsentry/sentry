from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional, Sequence, Union

import sentry_kafka_schemas
from arroyo import Topic
from arroyo.backends.abstract import Producer
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.conf import settings
from django.core.cache import cache

from sentry import quotas
from sentry.sentry_metrics.client.base import GenericMetricsBackend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils import json
from sentry.utils.kafka_config import get_kafka_producer_cluster_options

ingest_codec: sentry_kafka_schemas.codecs.Codec[Any] = sentry_kafka_schemas.get_codec(
    "ingest-metrics"
)


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


class KafkaMetricsBackend(GenericMetricsBackend):
    def __init__(self) -> None:
        kafka_topic_name = settings.KAFKA_INGEST_PERFORMANCE_METRICS
        self.kafka_topic = Topic(kafka_topic_name)

        kafka_topic_dict = settings.KAFKA_TOPICS[kafka_topic_name]
        assert kafka_topic_dict is not None
        cluster_name = kafka_topic_dict["cluster"]
        producer_config = get_kafka_producer_cluster_options(cluster_name)
        self.producer: Producer = KafkaProducer(
            build_kafka_configuration(default_config=producer_config)
        )

    def counter(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Union[int, float],
        tags: Dict[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Emit a counter metric for internal use cases only.
        Note that, as of now, this function will return
        immediately even if the metric message has not been
        produced to the broker yet.
        """

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

        self.__produce(counter_metric, use_case_id)

    def set(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[int],
        tags: Dict[str, str],
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

        self.__produce(set_metric, use_case_id)

    def distribution(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[Union[int, float]],
        tags: Dict[str, str],
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

        self.__produce(dist_metric, use_case_id)

    def __produce(self, metric: Dict[str, Any], use_case_id: UseCaseID):
        ingest_codec.validate(metric)
        payload = KafkaPayload(
            None,
            json.dumps(metric).encode("utf-8"),
            [
                ("namespace", use_case_id.value.encode()),
            ],
        )
        self.producer.produce(self.kafka_topic, payload)

    def close(self) -> None:
        """
        Calling this is not required and is mostly for usage in tests
        """
        self.producer.close()
