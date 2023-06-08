from __future__ import annotations

from datetime import datetime
from typing import Mapping, Optional, Sequence, Union

from arroyo import Topic
from arroyo.backends.abstract import Producer
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.conf import settings

from sentry.sentry_metrics.metrics_interface import GenericMetricsBackend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils import json
from sentry.utils.kafka_config import get_kafka_producer_cluster_options


def build_mri(metric_name: str, type: str, use_case_id: UseCaseID, unit: Optional[str]) -> str:
    mri_unit = "none" if unit is None else unit
    return f"{type}:{use_case_id.value}/{metric_name}@{mri_unit}"


# def set_future(f: Future[BrokerValue[KafkaPayload]]) -> Future[None]:
#     new_future: Future[None] = Future()

#     if f.exception() is not None:
#         new_future.set_exception(f.exception())
#     else:
#         new_future.set_result(None)

#     return new_future


class KafkaMetricsBackend(GenericMetricsBackend):
    def __init__(self) -> None:

        kafka_topic_name = settings.KAFKA_INGEST_PERFORMANCE_METRICS
        self.kafka_topic = Topic(kafka_topic_name)

        kafka_topic_dict = settings.KAFKA_TOPICS[kafka_topic_name]
        assert kafka_topic_dict is not None
        cluster_name = kafka_topic_dict["cluster"]
        producer_config = get_kafka_producer_cluster_options(cluster_name)
        producer_config.pop("compression.type", None)
        producer_config.pop("message.max.bytes", None)
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
        tags: Mapping[str, str],
        unit: Optional[str] = None,
        retention_days: Optional[int] = None,
    ) -> None:

        """
        Emit a counter metric for internal use cases only.
        Ensure that the use_case_id passed in has been registered
        in the UseCaseID enum.
        """

        counter_metric = {
            "org_id": org_id,
            "project_id": project_id,
            "name": build_mri(metric_name, "c", use_case_id, unit),
            "value": value,
            "timestamp": int(datetime.now().timestamp()),
            "tags": tags,
            "retention_days": retention_days,
        }

        payload = KafkaPayload(None, json.dumps(counter_metric).encode("utf-8"), [])
        self.producer.produce(self.kafka_topic, payload)

    def set(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[int],
        tags: Mapping[str, str],
        unit: Optional[str] = None,
        retention_days: Optional[int] = None,
    ) -> None:

        """
        Emit a set metric for internal use cases only. Can support
        a sequence of values. Ensure that the use_case_id passed in has
        been registered in the UseCaseID enum.
        """

        set_metric = {
            "org_id": org_id,
            "project_id": project_id,
            "name": build_mri(metric_name, "s", use_case_id, unit),
            "value": value,
            "timestamp": int(datetime.now().timestamp()),
            "tags": tags,
            "retention_days": retention_days,
        }

        payload = KafkaPayload(None, json.dumps(set_metric).encode("utf-8"), [])
        self.producer.produce(self.kafka_topic, payload)

    def distribution(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[Union[int, float]],
        tags: Mapping[str, str],
        unit: Optional[str] = None,
        retention_days: Optional[int] = None,
    ) -> None:

        """
        Emit a distribution metric for internal use cases only. Can
        support a sequence of values. Ensure that the use_case_id passed in
        has been registered in the UseCaseID enum.
        """
        dist_metric = {
            "org_id": org_id,
            "project_id": project_id,
            "name": build_mri(metric_name, "d", use_case_id, unit),
            "value": value,
            "timestamp": int(datetime.now().timestamp()),
            "tags": tags,
            "retention_days": retention_days,
        }

        payload = KafkaPayload(None, json.dumps(dist_metric).encode("utf-8"), [])
        self.producer.produce(self.kafka_topic, payload)

    def close(self):
        self.producer.close()
