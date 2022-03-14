from datetime import datetime
from typing import Any, MutableMapping, Sequence

import msgpack
from confluent_kafka import Producer
from django.conf import settings
from exam import fixture

from sentry.profiles.consumer import get_profiles_consumer
from sentry.testutils.cases import SnubaTestCase, TestCase


class ProfilesConsumerTest(TestCase, SnubaTestCase):
    @fixture
    def valid_payload(self):
        return {
            "organization_id": 1,
            "project_id": 1,
            "received": datetime.utcnow().timestamp(),
            "payload": {},
        }

    @fixture
    def topic(self):
        return "profiles"

    @fixture
    def producer(self):
        cluster_name = settings.KAFKA_TOPICS[self.topic]["cluster"]
        config = {
            "bootstrap.servers": settings.KAFKA_CLUSTERS[cluster_name]["common"][
                "bootstrap.servers"
            ],
            "session.timeout.ms": 6000,
        }
        return Producer(config)

    def setUp(self):
        super().setUp()

    def tearDown(self):
        super().tearDown()

    def flush_batch(self, profiles: Sequence[MutableMapping[str, Any]]) -> None:
        for p in profiles:
            for k in ["project_id", "organization_id", "received"]:
                assert k in p

    def test_normal(self):
        consumer = get_profiles_consumer()

        consumer.flush_batch = self.flush_batch
        consumer.run()

        self.producer.produce(self.topic, msgpack.packb(self.valid_payalod))
        self.producer.flush()
