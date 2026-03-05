from django.conf import settings
from django.core.cache import cache

if settings.TASKWORKER_USE_LIBRARY:
    import threading

    from arroyo.backends.kafka import KafkaProducer
    from taskbroker_client.app import TaskbrokerApp

    from sentry.conf.types.kafka_definition import Topic
    from sentry.taskworker.metrics import SentryMetricsBackend
    from sentry.taskworker.router import SentryRouter
    from sentry.utils.arroyo_producer import get_arroyo_producer

    _producer_local = threading.local()

    def _make_producer(topic: str) -> KafkaProducer:
        if not hasattr(_producer_local, "producers"):
            _producer_local.producers = {}
        if topic not in _producer_local.producers:
            _producer_local.producers[topic] = get_arroyo_producer(
                f"sentry.taskworker.{topic}", Topic(topic)
            )
        return _producer_local.producers[topic]

    app = TaskbrokerApp(
        name="sentry",
        producer_factory=_make_producer,
        metrics_class=SentryMetricsBackend(),
        router_class=SentryRouter(),
    )
    app.set_config(
        {
            "rpc_secret": settings.TASKWORKER_SHARED_SECRET,
            "at_most_once_timeout": 60 * 60 * 24,  # 1 day
        }
    )
    app.set_modules(settings.TASKWORKER_IMPORTS)
    app.at_most_once_store(cache)
else:
    from sentry.taskworker.app import TaskworkerApp

    app = TaskworkerApp(name="sentry")
    app.set_config(
        {
            "rpc_secret": settings.TASKWORKER_SHARED_SECRET,
            "at_most_once_timeout": 60 * 60 * 24,  # 1 day
        }
    )
    app.set_modules(settings.TASKWORKER_IMPORTS)
    app.at_most_once_store(cache)
