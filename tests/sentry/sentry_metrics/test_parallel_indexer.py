from datetime import datetime, timezone

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message, Partition, Topic

from sentry.sentry_metrics.configuration import (
    RELEASE_HEALTH_PG_NAMESPACE,
    IndexerStorage,
    MetricsIngestConfiguration,
    UseCaseKey,
)
from sentry.sentry_metrics.consumers.indexer.parallel import MetricsConsumerStrategyFactory
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.utils import json

ts = int(datetime.now(tz=timezone.utc).timestamp())
counter_payload = {
    "name": SessionMRI.SESSION.value,
    "tags": {
        "environment": "production",
        "session.status": "init",
    },
    "timestamp": ts,
    "type": "c",
    "value": 1.0,
    "org_id": 1,
    "project_id": 3,
}


def test_basic(request):
    """
    Integration test to verify that the parallel indexer can spawn subprocesses
    properly. The main purpose is to verify that there are no
    pickling/unpickling errors when passing the strategy into the
    ParallelTransformStep, as that is easy to break.
    """
    processing_factory = MetricsConsumerStrategyFactory(
        max_msg_batch_size=1,
        max_msg_batch_time=1,
        max_parallel_batch_size=1,
        max_parallel_batch_time=1,
        max_batch_size=1,
        max_batch_time=1,
        processes=1,
        input_block_size=1024,
        output_block_size=1024,
        config=MetricsIngestConfiguration(
            db_backend=IndexerStorage.MOCK,
            db_backend_options={},
            input_topic="ingest-metrics",
            output_topic="snuba-metrics",
            use_case_id=UseCaseKey.RELEASE_HEALTH,
            internal_metrics_tag="test",
            writes_limiter_cluster_options={},
            writes_limiter_namespace="test",
            cardinality_limiter_cluster_options={},
            cardinality_limiter_namespace=RELEASE_HEALTH_PG_NAMESPACE,
            index_tag_values_option_name="sentry-metrics.performance.index-tag-values",
        ),
    )

    strategy = processing_factory.create_with_partitions(
        lambda _: None,
        {Partition(topic=Topic(name="ingest-bogus-metrics"), index=1): 1},
    )

    message = Message(
        Partition(Topic("topic"), 0),
        0,
        KafkaPayload(None, json.dumps(counter_payload).encode("utf-8"), []),
        datetime.now(),
    )

    # Just assert that the strategy does not crash. Further assertions, such as
    # on the produced messages, would slow down the test significantly.
    strategy.submit(message=message)
    strategy.close()
    strategy.join()
