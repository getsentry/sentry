import atexit
from typing import Optional

from arroyo.backends.abstract import Producer
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.conf import settings
from usageaccountant import UsageAccumulator, UsageUnit

from sentry.options import get
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

_accountant_backend: Optional[UsageAccumulator] = None


def init_backend(producer: Producer[KafkaPayload]) -> UsageAccumulator:
    """
    This method should be used externally only in tests to fit a
    mock producer.
    """
    global _accountant_backend

    assert _accountant_backend is None, "Accountant already initialized once."
    _accountant_backend = UsageAccumulator(producer=producer)


def record(
    resource_id: str,
    app_feature: str,
    amount: int,
    usage_type: UsageUnit,
) -> None:
    global _accountant_backend

    if resource_id not in get("shared_resources_accounting_enabled"):
        return

    def _shutdown() -> None:
        _accountant_backend.flush()
        _accountant_backend.close()

    if _accountant_backend is None:
        cluster_name = get_topic_definition(
            settings.KAFKA_SHARED_RESOURCES_USAGE,
        )["cluster"]
        producer_config = get_kafka_producer_cluster_options(cluster_name)
        producer = KafkaProducer(
            build_kafka_configuration(
                default_config=producer_config,
            )
        )

        init_backend(producer)
        atexit.register(_shutdown)

    _accountant_backend.record(resource_id, app_feature, amount, usage_type)
