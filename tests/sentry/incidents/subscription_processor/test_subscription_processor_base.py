from datetime import timedelta
from functools import cached_property
from random import randint
from unittest import mock
from uuid import uuid4

import pytest
from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.subscription_processor import (
    SubscriptionProcessor,
    store_detector_last_update,
)
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models import DataSource, DataSourceDetector, DetectorState
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.types import DetectorPriorityLevel

EMPTY = object()


@freeze_time()
class ProcessUpdateBaseClass(TestCase, SpanTestCase, SnubaTestCase):
    @pytest.fixture(autouse=True)
    def _setup_metrics_patch(self):
        with mock.patch("sentry.incidents.subscription_processor.metrics") as self.metrics:
            yield

    def setUp(self) -> None:
        super().setUp()
        self._run_tasks = self.tasks()
        self._run_tasks.__enter__()
        self.detector = self.metric_detector

    def tearDown(self) -> None:
        super().tearDown()
        self._run_tasks.__exit__(None, None, None)

    @cached_property
    def sub(self):
        subscription_id = int(self.metric_detector.data_sources.first().source_id)
        return QuerySubscription.objects.get(id=subscription_id)

    def create_detector_data_source_and_data_conditions(self):
        detector = self.create_detector(
            project=self.project,
            workflow_condition_group=self.create_data_condition_group(),
            type=MetricIssue.slug,
            created_by_id=self.user.id,
        )
        self.create_detector_state(detector=detector)
        with self.tasks():
            snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.ERROR,
                dataset=Dataset.Events,
                query="",
                aggregate="count()",
                time_window=timedelta(minutes=1),
                resolution=timedelta(minutes=1),
                environment=self.environment,
                event_types=[
                    SnubaQueryEventType.EventType.ERROR,
                    SnubaQueryEventType.EventType.DEFAULT,
                ],
            )
            query_subscription = create_snuba_subscription(
                project=detector.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=snuba_query,
            )
        data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )
        self.create_data_source_detector(data_source, detector)

        self.set_up_data_conditions(detector, Condition.GREATER, 100, None, 10)

        return detector

    def set_up_data_conditions(
        self,
        detector: Detector,
        threshold_type: Condition,
        critical_threshold: int,
        warning_threshold: int | None = None,
        resolve_threshold: int | None = None,
    ):
        if resolve_threshold is None:
            resolve_threshold = (
                critical_threshold if warning_threshold is None else warning_threshold
            )
        resolve_threshold_type = (
            Condition.LESS_OR_EQUAL
            if threshold_type == Condition.GREATER
            else Condition.GREATER_OR_EQUAL
        )

        self.create_data_condition(
            type=threshold_type,
            comparison=critical_threshold,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=detector.workflow_condition_group,
        )
        if warning_threshold is not None:
            self.create_data_condition(
                type=threshold_type,
                comparison=warning_threshold,
                condition_result=DetectorPriorityLevel.MEDIUM,
                condition_group=detector.workflow_condition_group,
            )
        self.create_data_condition(
            type=resolve_threshold_type,
            comparison=resolve_threshold,
            condition_result=DetectorPriorityLevel.OK,
            condition_group=detector.workflow_condition_group,
        )

    @cached_property
    def metric_detector(self):
        return self.create_detector_data_source_and_data_conditions()

    @cached_property
    def critical_threshold(self):
        critical_detector_trigger = DataCondition.objects.get(
            condition_group=self.metric_detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        return critical_detector_trigger.comparison

    @cached_property
    def warning_threshold(self):
        warning_detector_trigger = DataCondition.objects.get(
            condition_group=self.metric_detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.MEDIUM,
        )
        return warning_detector_trigger.comparison

    @cached_property
    def resolve_threshold(self):
        resolve_detector_trigger = DataCondition.objects.get(
            condition_group=self.metric_detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.OK,
        )
        return resolve_detector_trigger.comparison

    def get_snuba_query(self, detector: Detector):
        data_source_detector = DataSourceDetector.objects.get(detector=detector)
        data_source = DataSource.objects.get(id=data_source_detector.data_source.id)
        query_subscription = QuerySubscription.objects.get(id=data_source.source_id)
        snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query.id)
        return snuba_query

    def update_threshold(
        self, detector: Detector, priority_level: DetectorPriorityLevel, new_threshold: float
    ) -> None:
        detector_trigger = DataCondition.objects.get(
            condition_group=detector.workflow_condition_group,
            condition_result=priority_level,
        )
        detector_trigger.comparison = new_threshold
        detector_trigger.save()

    def build_subscription_update(self, subscription, time_delta=None, value=EMPTY):
        if time_delta is not None:
            timestamp = timezone.now() + time_delta
        else:
            timestamp = timezone.now()
        timestamp = timestamp.replace(microsecond=0)

        data = {}

        if subscription:
            data = {"some_col_name": randint(0, 100) if value is EMPTY else value}
        values = {"data": [data]}
        return {
            "subscription_id": subscription.subscription_id if subscription else uuid4().hex,
            "values": values,
            "timestamp": timestamp,
            "interval": 1,
            "partition": 1,
            "offset": 1,
        }

    def send_update(self, value, time_delta=None, subscription=None):
        if time_delta is None:
            time_delta = timedelta()
        if subscription is None:
            subscription = self.sub
        processor = SubscriptionProcessor(subscription)
        message = self.build_subscription_update(subscription, value=value, time_delta=time_delta)
        with (
            self.feature(["organizations:incidents", "organizations:performance-view"]),
            self.capture_on_commit_callbacks(execute=True),
        ):
            return processor.process_update(message)

    def get_detector_state(self, detector: Detector) -> int:
        detector_state = DetectorState.objects.get(detector=detector)
        return int(detector_state.state)


class TestSubscriptionProcessorLastUpdate(ProcessUpdateBaseClass):
    def test_uses_stored_last_update_value(self) -> None:
        stored_timestamp = timezone.now() + timedelta(minutes=10)
        store_detector_last_update(self.metric_detector, self.project.id, stored_timestamp)

        processor = SubscriptionProcessor(self.sub)
        old_update_message = self.build_subscription_update(
            self.sub, value=self.critical_threshold + 1, time_delta=timedelta(minutes=5)
        )

        with (
            self.feature(["organizations:incidents", "organizations:performance-view"]),
            self.capture_on_commit_callbacks(execute=True),
        ):
            result = processor.process_update(old_update_message)

        assert result is False

    def test_no_detector_returns_false_without_exception(self) -> None:
        with self.tasks():
            snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.ERROR,
                dataset=Dataset.Events,
                query="",
                aggregate="count()",
                time_window=timedelta(minutes=1),
                resolution=timedelta(minutes=1),
                environment=self.environment,
                event_types=[
                    SnubaQueryEventType.EventType.ERROR,
                    SnubaQueryEventType.EventType.DEFAULT,
                ],
            )
            subscription_without_detector = create_snuba_subscription(
                project=self.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=snuba_query,
            )

        processor = SubscriptionProcessor(subscription_without_detector)
        assert processor.detector is None

        message = self.build_subscription_update(subscription_without_detector, value=100)
        with (
            self.feature(["organizations:incidents", "organizations:performance-view"]),
            self.capture_on_commit_callbacks(execute=True),
        ):
            result = processor.process_update(message)

        assert result is False
