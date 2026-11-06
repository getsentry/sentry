from __future__ import annotations

from collections.abc import Iterable
from datetime import timedelta

import pytest

from sentry.constants import ObjectStatus
from sentry.incidents.logic import (
    DEFAULT_ALERT_RULE_RESOLUTION,
    DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION,
    EAP_FUNCTIONS,
    get_alert_resolution,
    translate_aggregate_field,
    update_detector,
)
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.ourlogs.aggregates import LOG_AGGREGATE_COMBINATORS
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.spans.aggregates import SPAN_AGGREGATE_COMBINATORS
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
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


# EAP functions that metric monitors don't accept. A function added to the span or log definitions
# fails test_eap_functions_cover_eap_definitions until it is added here or to EAP_FUNCTIONS.
EAP_FUNCTIONS_EXCLUDED_FROM_MONITORS = {
    # Insights creates monitors with equivalent count() queries instead, because Explore and
    # alerts don't support these.
    "cache_miss_rate",
    "count_scores",
    "http_response_rate",
    # Not reviewed for monitors. Move to EAP_FUNCTIONS when a monitor needs one.
    "any",
    "avg_compare",
    "avg_sample",
    "bounded_sample",
    "collect_unique",
    "count_op",
    "count_sample",
    "count_starts",
    "division",
    "elapsed_if",
    "first",
    "http_response_count",
    "last",
    "p50_sample",
    "time_spent_percentage",
    "tpm",
    "trace_status_rate",
    "ttfd_contribution_rate",
    "ttid_contribution_rate",
}


@pytest.mark.parametrize(
    ("definitions", "combinators"),
    [
        (SPAN_DEFINITIONS, SPAN_AGGREGATE_COMBINATORS),
        (OURLOG_DEFINITIONS, LOG_AGGREGATE_COMBINATORS),
    ],
    ids=["spans", "logs"],
)
def test_eap_functions_cover_eap_definitions(
    definitions: ColumnDefinitions, combinators: Iterable[str]
) -> None:
    defined = set(definitions.aggregates) | set(definitions.formulas)
    # Combinator variants such as avg_if are covered by their base function. Monitors filter with
    # the query instead.
    combinator_variants = {
        f"{function}_{combinator}" for function in defined for combinator in combinators
    }
    undecided = (
        defined - combinator_variants - set(EAP_FUNCTIONS) - EAP_FUNCTIONS_EXCLUDED_FROM_MONITORS
    )
    assert not undecided, (
        f"Decide whether metric monitors should accept {sorted(undecided)}: add each to "
        "EAP_FUNCTIONS in src/sentry/incidents/logic.py, or to EAP_FUNCTIONS_EXCLUDED_FROM_MONITORS."
    )


def test_eap_functions_excluded_from_monitors_are_defined() -> None:
    defined = (
        set(SPAN_DEFINITIONS.aggregates)
        | set(SPAN_DEFINITIONS.formulas)
        | set(OURLOG_DEFINITIONS.aggregates)
    )
    assert EAP_FUNCTIONS_EXCLUDED_FROM_MONITORS <= defined
    assert not EAP_FUNCTIONS_EXCLUDED_FROM_MONITORS & set(EAP_FUNCTIONS)
