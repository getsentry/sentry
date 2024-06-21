import uuid
from datetime import datetime
from hashlib import md5
from unittest import mock

from arroyo import Message
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Partition, Topic
from django.test import override_settings

from sentry.conf.types import kafka_definition
from sentry.issues.grouptype import UptimeDomainCheckFailure
from sentry.models.group import Group
from sentry.remote_subscriptions.consumers.result_consumer import FAKE_SUBSCRIPTION_ID
from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.consumers.results_consumer import UptimeResultsStrategyFactory


class ProcessResultTest(UptimeTestCase):
    def setUp(self):
        super().setUp()
        self.partition = Partition(Topic("test"), 0)

    def test(self):
        subscription_id = uuid.uuid4().hex
        subscription = self.create_uptime_subscription(subscription_id=subscription_id)
        project_subscription = self.create_project_uptime_subscription(
            uptime_subscription=subscription
        )
        result = self.create_uptime_result(subscription_id)
        codec = kafka_definition.get_topic_codec(kafka_definition.Topic.UPTIME_RESULTS)

        message = Message(
            BrokerValue(
                KafkaPayload(None, codec.encode(result), []),
                Partition(Topic("test"), 1),
                1,
                datetime.now(),
            )
        )
        project = self.project
        # TODO: Remove this once we have a subscription
        with override_settings(UPTIME_POC_PROJECT_ID=project.id), self.feature(
            UptimeDomainCheckFailure.build_ingest_feature_name()
        ):
            factory = UptimeResultsStrategyFactory()
            commit = mock.Mock()

            consumer = factory.create_with_partitions(commit, {self.partition: 0})
            consumer.submit(message)

        hashed_fingerprint = md5(str(project_subscription.id).encode("utf-8")).hexdigest()

        group = Group.objects.get(grouphash__hash=hashed_fingerprint)
        assert group.issue_type == UptimeDomainCheckFailure

    def test_no_subscription(self):
        # Temporary test to make sure hack fake subscription keeps working
        subscription_id = uuid.uuid4().hex
        result = self.create_uptime_result(subscription_id)
        codec = kafka_definition.get_topic_codec(kafka_definition.Topic.UPTIME_RESULTS)
        message = Message(
            BrokerValue(
                KafkaPayload(None, codec.encode(result), []),
                Partition(Topic("test"), 1),
                1,
                datetime.now(),
            )
        )
        project = self.project
        # TODO: Remove this once we have a subscription
        with override_settings(UPTIME_POC_PROJECT_ID=project.id), self.feature(
            UptimeDomainCheckFailure.build_ingest_feature_name()
        ):
            factory = UptimeResultsStrategyFactory()
            commit = mock.Mock()
            consumer = factory.create_with_partitions(commit, {self.partition: 0})
            consumer.submit(message)

        hashed_fingerprint = md5(str(FAKE_SUBSCRIPTION_ID).encode("utf-8")).hexdigest()

        group = Group.objects.get(grouphash__hash=hashed_fingerprint)
        assert group.issue_type == UptimeDomainCheckFailure
