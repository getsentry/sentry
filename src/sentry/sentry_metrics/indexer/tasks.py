import logging
from typing import Any, Dict, List

from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@instrumented_task(  # type: ignore
    name="sentry.sentry_metrics.indexer.tasks.process_indexed_metrics",
    queue="sentry_metrics.indexer",
    default_retry_delay=5,
    max_retries=5,
)
def process_indexed_metrics(messages: List[Dict[str, Any]], **kwargs: Any) -> None:
    metrics.incr("sentry_metrics.indexer.task.processed_messages")
