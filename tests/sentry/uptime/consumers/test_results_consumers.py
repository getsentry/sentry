import uuid
from datetime import datetime
from hashlib import md5
from unittest import mock

import pytest
from arroyo import Message
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Partition, Topic
from django.test import override_settings
from sentry_kafka_schemas.schema_types.uptime_results_v1 import CheckResult

from sentry.conf.types import kafka_definition
from sentry.issues.grouptype import UptimeDomainCheckFailure
from sentry.models.group import Group
from sentry.remote_subscriptions.consumers.result_consumer import FAKE_SUBSCRIPTION_ID
from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.consumers.results_consumer import (
    UptimeResultsStrategyFactory,
    build_last_update_key,
)
from sentry.uptime.detectors.ranking import _get_cluster


class ProcessResultTest(UptimeTestCase):
    def setUp(self):
        super().setUp()
        self.partition = Partition(Topic("test"), 0)
        self.subscription = self.create_uptime_subscription(subscription_id=uuid.uuid4().hex)
        self.project_subscription = self.create_project_uptime_subscription(
            uptime_subscription=self.subscription
        )

    def send_result(self, result: CheckResult):
        codec = kafka_definition.get_topic_codec(kafka_definition.Topic.UPTIME_RESULTS)
        message = Message(
            BrokerValue(
                KafkaPayload(None, codec.encode(result), []),
                Partition(Topic("test"), 1),
                1,
                datetime.now(),
            )
        )
        with self.feature(UptimeDomainCheckFailure.build_ingest_feature_name()):
            factory = UptimeResultsStrategyFactory()
            commit = mock.Mock()

            consumer = factory.create_with_partitions(commit, {self.partition: 0})
            consumer.submit(message)

    def test(self):
        result = self.create_uptime_result(self.subscription.subscription_id)
        self.send_result(result)
        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        group = Group.objects.get(grouphash__hash=hashed_fingerprint)
        assert group.issue_type == UptimeDomainCheckFailure

    def test_no_subscription(self):
        # Temporary test to make sure hack fake subscription keeps working
        other_project = self.create_project()
        subscription_id = uuid.uuid4().hex
        result = self.create_uptime_result(subscription_id)
        # TODO: Remove this once we have a subscription
        with override_settings(UPTIME_POC_PROJECT_ID=other_project.id):
            self.send_result(result)

        hashed_fingerprint = md5(str(FAKE_SUBSCRIPTION_ID).encode("utf-8")).hexdigest()

        group = Group.objects.get(grouphash__hash=hashed_fingerprint)
        assert group.issue_type == UptimeDomainCheckFailure

    def test_skip_already_processed(self):
        result = self.create_uptime_result(self.subscription.subscription_id)
        _get_cluster().set(
            build_last_update_key(self.project_subscription),
            int(result["scheduled_check_time_ms"]),
        )
        with mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics:
            self.send_result(result)
            metrics.incr.assert_called_once_with(
                "uptime.result_processor.skipping_already_processed_update"
            )

        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)
