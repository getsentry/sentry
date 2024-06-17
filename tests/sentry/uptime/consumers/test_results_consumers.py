from datetime import datetime
from hashlib import md5

from arroyo import Message, Topic
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Partition
from django.test import override_settings

from sentry.issues.grouptype import UptimeDomainCheckFailure
from sentry.models.group import Group
from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.consumers.results_consumer import UPTIME_RESULTS_CODEC, process_result


class ProcessResultTest(UptimeTestCase):
    def test(self):
        result = self.create_uptime_result()

        message = Message(
            BrokerValue(
                KafkaPayload(None, UPTIME_RESULTS_CODEC.encode(result), []),
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
            process_result(message)

        hashed_fingerprint = md5(result["subscription_id"].encode("utf-8")).hexdigest()

        group = Group.objects.get(grouphash__hash=hashed_fingerprint)
        assert group.issue_type == UptimeDomainCheckFailure
