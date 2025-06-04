from __future__ import annotations

from datetime import datetime

from arroyo import Topic as ArroyoTopic
from arroyo.backends.abstract import Producer
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.core.cache import cache
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.ingest_metrics_v1 import IngestMetric

from sentry import quotas
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.sentry_metrics.client.base import GenericMetricsBackend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils import json
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

INGEST_CODEC: Codec[IngestMetric] = get_topic_codec(Topic.INGEST_METRICS)


def build_mri(metric_name: str, type: str, use_case_id: UseCaseID, unit: str | None) -> str:
    mri_unit = "none" if unit is None else unit
    return f"{type}:{use_case_id.value}/{metric_name}@{mri_unit}"


def get_retention_from_org_id(org_id: int) -> int:
    cache_key = f"sentry_metrics:org_retention_days:{org_id}"
    cached_retention: int | None = cache.get(cache_key)

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
        logical_topic = Topic.INGEST_PERFORMANCE_METRICS
        topic_defn = get_topic_definition(logical_topic)
        self.kafka_topic = ArroyoTopic(topic_defn["real_topic_name"])
        cluster_name = topic_defn["cluster"]
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
        value: int | float,
        tags: dict[str, str],
        unit: str | None,
    ) -> None:
        """
        Emit a counter metric for internal use cases only.
        Note that, as of now, this function will return
        immediately even if the metric message has not been
        produced to the broker yet.
        """

        counter_metric: IngestMetric = {
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

    def __produce(self, metric: IngestMetric, use_case_id: UseCaseID):
        INGEST_CODEC.validate(metric)
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
