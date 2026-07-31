from copy import deepcopy
from functools import cached_property

from arroyo.utils import metrics

from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.snuba.query_subscriptions.consumer import subscriber_registry
from sentry.snuba.query_subscriptions.run import _process_subscription_message
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import json
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.detector_state import DetectorState
from sentry.workflow_engine.types import DetectorPriorityLevel


@freeze_time()
class HandleSnubaQueryUpdateTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.orig_registry = deepcopy(subscriber_registry)

    def tearDown(self) -> None:
        super().tearDown()
        subscriber_registry.clear()
        subscriber_registry.update(self.orig_registry)

        metrics._metrics_backend = None

    @cached_property
    def snuba_query(self) -> SnubaQuery:
        return SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            aggregate="count()",
            query="",
            time_window=60,
            resolution=60,
            environment=None,
        )

    @cached_property
    def subscription(self) -> QuerySubscription:
        return QuerySubscription.objects.create(
            status=QuerySubscription.Status.ACTIVE.value,
            project=self.project,
            snuba_query=self.snuba_query,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            subscription_id="8/fake_subscription_id",
        )

    @cached_property
    def detector(self) -> Detector:
        from sentry.incidents.grouptype import MetricIssue

        # Create condition group for detector thresholds
        condition_group = self.create_data_condition_group()

        detector = self.create_detector(
            name="Test Metric Alert Detector",
            project=self.project,
            type=MetricIssue.slug,
            workflow_condition_group=condition_group,
            created_by_id=self.user.id,
            config={
                "detection_type": "static",  # Required for MetricIssue detectors
                "comparison_delta": None,
            },
        )

        # Create DetectorState to track detector state
        self.create_detector_state(detector=detector)

        # Create data conditions for the detector (critical and resolve thresholds)
        # Critical: >= 100 triggers HIGH priority (matching AlertRule ABOVE semantics)
        self.create_data_condition(
            type=Condition.GREATER_OR_EQUAL,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=condition_group,
        )
        # Resolve: <= 10 triggers OK state
        self.create_data_condition(
            type=Condition.LESS_OR_EQUAL,
            comparison=10,
            condition_result=DetectorPriorityLevel.OK,
            condition_group=condition_group,
        )

        data_source = self.create_data_source(
            organization=self.organization,
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
            source_id=str(self.subscription.id),
        )
        self.create_data_source_detector(data_source=data_source, detector=detector)

        return detector

    def run_test(self) -> None:
        # Full integration test to ensure that when a subscription receives an update
        # the `QuerySubscriptionConsumer` successfully retries the subscription and
        # calls the correct callback, which should result in a GroupOpenPeriod being created.

        # Ensure detector is initialized before test runs
        _ = self.detector

        message = {
            "version": 3,
            "payload": {
                "subscription_id": self.subscription.subscription_id,
                "result": {
                    "data": [{"some_col": 101}],
                    "meta": [{"name": "count", "type": "UInt64"}],
                },
                "request": {
                    "some": "data",
                    "query": """MATCH (metrics_counters) SELECT sum(value) AS value BY
                            tags[3] WHERE org_id = 1 AND project_id IN tuple(1) AND metric_id = 16
                            AND tags[3] IN tuple(13, 4)""",
                },
                "entity": "metrics_counters",
                "timestamp": "2020-01-01T01:23:45.1234",
            },
        }

        original_callback = subscriber_registry[INCIDENTS_SNUBA_SUBSCRIPTION_TYPE]
        callback_invoked = []

        def shutdown_callback(*args, **kwargs):
            # We want to just exit after the callback so that we can see the result of
            # processing.
            callback_invoked.append(True)
            original_callback(*args, **kwargs)

        subscriber_registry[INCIDENTS_SNUBA_SUBSCRIPTION_TYPE] = shutdown_callback

        with self.feature("organizations:incidents"):
            with self.tasks(), self.capture_on_commit_callbacks(execute=True):
                # Integration test: verify taskbroker raw mode successfully processes
                # subscription updates through the workflow engine without error.
                _process_subscription_message(json.dumps(message).encode(), Dataset.Metrics)

            # Verify the callback was invoked
            assert callback_invoked, "Subscription processor callback should have been invoked"

            # Verify workflow engine evaluated the detector correctly
            detector_state = DetectorState.objects.filter(detector=self.detector).first()
            assert detector_state is not None
            assert detector_state.is_triggered

            # Note: This test verifies subscription processing through the workflow engine.
            # IssueOccurrences are created but not persisted to Groups in this test since
            # that would require the occurrence consumer to be running, which is outside
            # the scope of this taskbroker raw-mode integration test.

    def test_raw_subscription_task(self) -> None:
        self.run_test()
