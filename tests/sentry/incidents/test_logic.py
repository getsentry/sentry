from __future__ import annotations

from datetime import timedelta

import pytest

from sentry.constants import ObjectStatus
from sentry.incidents.logic import (
    DEFAULT_ALERT_RULE_RESOLUTION,
    DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION,
    get_alert_resolution,
    translate_aggregate_field,
    update_detector,
)
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import BaseIncidentsTest, TestCase
from sentry.workflow_engine.models.detector import Detector

pytestmark = [pytest.mark.sentry_metrics]


class EnableDisableDetectorTest(TestCase, BaseIncidentsTest):
    def setUp(self) -> None:
        self.detector = self.create_detector()

        with self.tasks():
            self.snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.ERROR,
                dataset=Dataset.Events,
                query="hello",
                aggregate="count()",
                time_window=timedelta(minutes=1),
                resolution=timedelta(minutes=1),
                environment=self.environment,
                event_types=([SnubaQueryEventType.EventType.ERROR]),
            )
            self.query_subscription = create_snuba_subscription(
                project=self.detector.linked_project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.snuba_query,
            )
        self.data_source = self.create_data_source(
            organization=self.organization, source_id=self.query_subscription.id
        )
        self.data_source.detectors.set([self.detector])

    def assert_detector_status(self, detector: Detector, enabled: bool = True) -> None:
        detector_status = ObjectStatus.ACTIVE if enabled else ObjectStatus.DISABLED
        query_subscription_status = (
            QuerySubscription.Status.ACTIVE.value
            if enabled
            else QuerySubscription.Status.DISABLED.value
        )

        detector.refresh_from_db()
        assert detector.status == detector_status

        query_subscriptions = QuerySubscription.objects.filter(
            id__in=[data_source.source_id for data_source in detector.data_sources.all()]
        )
        for qs in query_subscriptions:
            assert qs.status == query_subscription_status

    def test_enable(self) -> None:
        with self.tasks():
            update_detector(detector=self.detector, enabled=False)

        self.assert_detector_status(detector=self.detector, enabled=False)

        with self.tasks():
            update_detector(detector=self.detector, enabled=True)

        self.assert_detector_status(detector=self.detector, enabled=True)

    def test_disable(self) -> None:
        with self.tasks():
            update_detector(detector=self.detector, enabled=False)

        self.assert_detector_status(detector=self.detector, enabled=False)

    def test_multiple_data_sources_enable_disable(self) -> None:
        with self.tasks():
            self.snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.ERROR,
                dataset=Dataset.Events,
                query="hello again",
                aggregate="count()",
                time_window=timedelta(minutes=1),
                resolution=timedelta(minutes=1),
                environment=self.environment,
                event_types=([SnubaQueryEventType.EventType.ERROR]),
            )
            self.query_subscription = create_snuba_subscription(
                project=self.detector.linked_project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.snuba_query,
            )
        self.data_source = self.create_data_source(
            organization=self.organization, source_id=self.query_subscription.id
        )
        self.data_source.detectors.set([self.detector])

        with self.tasks():
            update_detector(detector=self.detector, enabled=False)

        self.assert_detector_status(detector=self.detector, enabled=False)

        with self.tasks():
            update_detector(detector=self.detector, enabled=True)

        self.assert_detector_status(detector=self.detector, enabled=True)


class MetricTranslationTest(TestCase):
    def test_simple(self) -> None:
        aggregate = "count_unique(user)"
        translated = translate_aggregate_field(aggregate)
        assert translated == "count_unique(tags[sentry:user])"

        # Make sure it doesn't double encode:
        translated_2 = translate_aggregate_field(translated)
        assert translated_2 == "count_unique(tags[sentry:user])"

    def test_reverse(self) -> None:
        aggregate = "count_unique(tags[sentry:user])"
        translated = translate_aggregate_field(aggregate, reverse=True)
        assert translated == "count_unique(user)"

        # Make sure it doesn't do anything wonky running twice:
        translated_2 = translate_aggregate_field(translated, reverse=True)
        assert translated_2 == "count_unique(user)"


class TestGetAlertResolution(TestCase):
    def test_simple(self) -> None:
        time_window = 30
        result = get_alert_resolution(time_window, self.organization)
        assert result == timedelta(minutes=DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION[time_window])

    def test_low_range(self) -> None:
        time_window = 2
        result = get_alert_resolution(time_window, self.organization)
        assert result == timedelta(minutes=DEFAULT_ALERT_RULE_RESOLUTION)

    def test_high_range(self) -> None:
        last_window = list(DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION.keys())[-1]
        time_window = last_window + 1000
        result = get_alert_resolution(time_window, self.organization)

        assert result == timedelta(minutes=DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION[last_window])

    def test_mid_range(self) -> None:
        time_window = 125
        result = get_alert_resolution(time_window, self.organization)

        # 125 is not part of the dict, will round down to the lower window of 120
        assert result == timedelta(minutes=3)

    def test_crazy_low_range(self) -> None:
        time_window = -5
        result = get_alert_resolution(time_window, self.organization)
        assert result == timedelta(minutes=DEFAULT_ALERT_RULE_RESOLUTION)
