from collections.abc import Callable

from taskbroker_client.types import CloseableProducerProtocol
from taskbroker_client.worker.producer import TaskProducer

from sentry.taskworker.adapters import make_metrics


def get_task_producer(
    producer_name: str,
    producer_factory: Callable[[], CloseableProducerProtocol],
) -> TaskProducer:
    """
    Helper function to get a TaskProducer instance with the metrics_backend already instantiated.
    """
    return TaskProducer(
        name=producer_name,
        producer_factory=producer_factory,
        metrics_backend=make_metrics(),
    )
