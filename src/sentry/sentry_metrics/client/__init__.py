from sentry.utils.services import LazyServiceWrapper

from .base import GenericMetricsBackend

backend = LazyServiceWrapper(
    GenericMetricsBackend,
    "sentry.sentry_metrics.client.kafka.KafkaMetricsBackend",
    {},
)
backend.expose(locals())
