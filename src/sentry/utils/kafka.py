import logging
import signal

from django.conf import settings

from sentry.utils.batching_kafka_consumer import BatchingKafkaConsumer

logger = logging.getLogger(__name__)


def create_batching_kafka_consumer(topic_names, worker, **options):
    from sentry.utils import metrics

    # In some cases we want to override the configuration stored in settings from the command line
    force_topic = options.pop("force_topic", None)
    force_cluster = options.pop("force_cluster", None)

    if force_topic and force_cluster:
        topic_names = {force_topic}
        cluster_names = {force_cluster}
    elif force_topic or force_cluster:
        raise ValueError(
            "Both 'force_topic' and 'force_cluster' have to be provided to override the configuration"
        )
    else:
        cluster_names = {settings.KAFKA_TOPICS[topic_name]["cluster"] for topic_name in topic_names}

    if len(cluster_names) > 1:
        raise ValueError(
            f"Cannot launch Kafka consumer listening to multiple topics ({topic_names}) on different clusters ({cluster_names})"
        )

    (cluster_name,) = cluster_names

    consumer = BatchingKafkaConsumer(
        topics=topic_names,
        cluster_name=cluster_name,
        worker=worker,
        metrics=metrics,
        metrics_default_tags={
            "topics": ",".join(sorted(topic_names)),
            "group_id": options.get("group_id"),
        },
        **options,
    )

    return consumer


def run_processor_with_signals(processor):
    def handler(signum, frame):
        processor.signal_shutdown()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)

    processor.run()
