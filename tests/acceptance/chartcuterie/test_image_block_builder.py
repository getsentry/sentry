import uuid

import pytest

from sentry.integrations.slack.message_builder.image_block_builder import ImageBlockBuilder
from sentry.issues.grouptype import PerformanceP95EndpointRegressionGroupType
from sentry.models.group import Group
from sentry.testutils.cases import AcceptanceTestCase, MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = pytest.mark.sentry_metrics


class TestSlackImageBlockBuilder(
    AcceptanceTestCase, MetricsEnhancedPerformanceTestCase, OccurrenceTestMixin
):
    def setUp(self):
        super().setUp()
        self.features = {
            "organizations:performance-use-metrics": True,
            "organizations:slack-endpoint-regression-image": True,
        }

    @with_feature("organizations:slack-endpoint-regression-image")
    def test_image_block(self):
        for i in range(10):
            event_id = uuid.uuid4().hex
            _ = self.process_occurrence(
                project_id=self.project.id,
                event_id=event_id,
                type=PerformanceP95EndpointRegressionGroupType.type_id,
                event_data={
                    "fingerprint": ["group-1"],
                    "timestamp": before_now(minutes=i + 10).isoformat(),
                    "transaction": "/books/",
                },
                evidence_data={
                    "breakpoint": before_now(minutes=i + 10).timestamp(),
                },
            )
            self.store_transaction_metric(
                metric="transaction.duration",
                tags={"transaction": "/books/"},
                value=1,
                timestamp=before_now(minutes=i + 10),
                project=self.project.id,
            )
        group = Group.objects.first()
        group.update(type=PerformanceP95EndpointRegressionGroupType.type_id)

        with self.feature(self.features):
            image_block = ImageBlockBuilder(group=group).build_image_block()

        assert image_block and "type" in image_block and image_block["type"] == "image"
        assert "_media/" in image_block["image_url"]
