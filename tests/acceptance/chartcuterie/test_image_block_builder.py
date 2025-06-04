import uuid
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core.cache import cache

from sentry.integrations.slack.message_builder.image_block_builder import ImageBlockBuilder
from sentry.issues.grouptype import (
    PerformanceHTTPOverheadGroupType,
    PerformanceP95EndpointRegressionGroupType,
    ProfileFunctionRegressionType,
)
from sentry.models.group import Group
from sentry.testutils.cases import (
    AcceptanceTestCase,
    MetricsEnhancedPerformanceTestCase,
    ProfilesSnubaTestCase,
)
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = pytest.mark.sentry_metrics


class TestSlackImageBlockBuilder(
    AcceptanceTestCase,
    MetricsEnhancedPerformanceTestCase,
    ProfilesSnubaTestCase,
    OccurrenceTestMixin,
):
    def setUp(self):
        super().setUp()
        cache.clear()

    def _create_endpoint_regression_issue(self):
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
        group = Group.objects.get()
        group.update(type=PerformanceP95EndpointRegressionGroupType.type_id)
        return group

    @with_feature("organizations:performance-use-metrics")
    def test_image_block_for_endpoint_regression(self):
        group = self._create_endpoint_regression_issue()
        image_block = ImageBlockBuilder(group=group).build_image_block()

        assert image_block and "type" in image_block and image_block["type"] == "image"
        assert "_media/" in image_block["image_url"]

    @with_feature("organizations:performance-use-metrics")
    @patch("sentry.utils.performance_issues.detectors.utils.escape_transaction")
    def test_caching(self, mock_escape_transaction):
        mock_escape_transaction.return_value = "Test Transaction"
        group = self._create_endpoint_regression_issue()
        image_blocks = []
        for _ in range(5):
            image_blocks.append(ImageBlockBuilder(group=group).build_image_block())

        assert mock_escape_transaction.call_count == 1
        assert len(image_blocks) == 5

        assert image_blocks[0]
        image_url = image_blocks[0]["image_url"]
        for image_block in image_blocks:
            assert image_block is not None
            assert image_block["image_url"] == image_url

    @with_feature("organizations:performance-use-metrics")
    def test_image_block_for_function_regression(self):
        hour_ago = (before_now(minutes=10) - timedelta(hours=1)).replace(
            minute=0, second=0, microsecond=0
        )

        for i in range(10):
            event_id = uuid.uuid4().hex
            _ = self.process_occurrence(
                project_id=self.project.id,
                event_id=event_id,
                type=ProfileFunctionRegressionType.type_id,
                event_data={
                    "fingerprint": ["group-1"],
                    "timestamp": before_now(minutes=i + 10).isoformat(),
                    "function": "foo",
                },
                evidence_data={
                    "breakpoint": before_now(minutes=i + 10).timestamp(),
                    "fingerprint": self.function_fingerprint({"package": "foo", "function": "foo"}),
                    "aggregate_range_1": 51588984.199999996,
                    "aggregate_range_2": 839118611.8535699,
                },
            )

            self.store_functions(
                [
                    {
                        "self_times_ns": [100 for _ in range(100)],
                        "package": "foo",
                        "function": "foo",
                        # only in app functions should
                        # appear in the results
                        "in_app": True,
                    },
                ],
                project=self.project,
                timestamp=hour_ago,
            )

        group = Group.objects.get()

        image_block = ImageBlockBuilder(group=group).build_image_block()

        assert image_block and "type" in image_block and image_block["type"] == "image"
        assert "_media/" in image_block["image_url"]

    @patch("sentry_sdk.capture_exception")
    def test_image_not_generated_for_unsupported_issues(self, mock_capture_exception):
        group = self.create_group()
        group.update(type=PerformanceHTTPOverheadGroupType.type_id)
        image_block = ImageBlockBuilder(group=group).build_image_block()

        assert image_block is None
        assert mock_capture_exception.call_count == 0
