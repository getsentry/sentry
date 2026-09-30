from __future__ import annotations

from datetime import timedelta
from unittest import mock

import pytest
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.incidents.events import IncidentCreatedEvent, IncidentStatusUpdatedEvent
from sentry.incidents.logic import (
    DEFAULT_ALERT_RULE_RESOLUTION,
    DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION,
    create_incident,
    create_incident_activity,
    get_alert_resolution,
    translate_aggregate_field,
    update_detector,
    update_incident_status,
)
from sentry.incidents.models.incident import (
    Incident,
    IncidentActivity,
    IncidentActivityType,
    IncidentProject,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentType,
)
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import BaseIncidentsTest, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models.detector import Detector

pytestmark = [pytest.mark.sentry_metrics]


class CreateIncidentTest(TestCase):
    @pytest.fixture(autouse=True)
    def _patch_record_event(self):
        with mock.patch(
            "sentry.analytics.base.Analytics.record_event_envelope"
        ) as self.record_event:
            yield

    def test_simple(self) -> None:
        incident_type = IncidentType.ALERT_TRIGGERED
        title = "hello"
        date_started = timezone.now() - timedelta(minutes=5)
        date_detected = timezone.now() - timedelta(minutes=4)
        alert_rule = self.create_alert_rule()

        self.record_event.reset_mock()
        incident = create_incident(
            self.organization,
            incident_type=incident_type,
            title=title,
            date_started=date_started,
            date_detected=date_detected,
            projects=[self.project],
            alert_rule=alert_rule,
        )
        assert incident.identifier == 1
        assert incident.status == IncidentStatus.OPEN.value
        assert incident.type == incident_type.value
        assert incident.title == title
        assert incident.date_started == date_started
        assert incident.date_detected == date_detected
        assert incident.alert_rule == alert_rule
        assert IncidentProject.objects.filter(
            incident=incident, project__in=[self.project]
        ).exists()
        assert (
            IncidentActivity.objects.filter(
                incident=incident,
                type=IncidentActivityType.DETECTED.value,
                date_added=date_started,
            ).count()
            == 1
        )
        assert (
            IncidentActivity.objects.filter(
                incident=incident, type=IncidentActivityType.CREATED.value
            ).count()
            == 1
        )
        assert len(self.record_event.call_args_list) == 1
        event = self.record_event.call_args[0][0].event
        assert event == IncidentCreatedEvent(
            organization_id=self.organization.id,
            incident_id=incident.id,
            incident_type=IncidentType.ALERT_TRIGGERED.value,
        )


@freeze_time()
class UpdateIncidentStatus(TestCase):
    @pytest.fixture(autouse=True)
    def _patch_record_event(self):
        with mock.patch(
            "sentry.analytics.base.Analytics.record_event_envelope"
        ) as self.record_event:
            yield

    def get_most_recent_incident_activity(self, incident):
        return IncidentActivity.objects.filter(incident=incident).order_by("-id")[:1].get()

    def test_status_already_set(self) -> None:
        incident = self.create_incident(status=IncidentStatus.WARNING.value)
        update_incident_status(
            incident, IncidentStatus.WARNING, status_method=IncidentStatusMethod.RULE_TRIGGERED
        )
        assert incident.status == IncidentStatus.WARNING.value

    def run_test(self, incident, status, expected_date_closed, user=None, date_closed=None):
        prev_status = incident.status
        self.record_event.reset_mock()
        update_incident_status(
            incident,
            status,
            status_method=IncidentStatusMethod.RULE_TRIGGERED,
            date_closed=date_closed,
        )
        incident = Incident.objects.get(id=incident.id)
        assert incident.status == status.value
        assert incident.date_closed == expected_date_closed
        activity = self.get_most_recent_incident_activity(incident)
        assert activity.type == IncidentActivityType.STATUS_CHANGE.value
        assert activity.value == str(status.value)
        assert activity.previous_value == str(prev_status)

        assert len(self.record_event.call_args_list) == 1
        event = self.record_event.call_args[0][0].event
        assert event == IncidentStatusUpdatedEvent(
            organization_id=self.organization.id,
            incident_id=incident.id,
            incident_type=incident.type,
            prev_status=prev_status,
            status=incident.status,
        )

    def test_closed(self) -> None:
        incident = self.create_incident(
            self.organization, title="Test", date_started=timezone.now(), projects=[self.project]
        )
        self.run_test(incident, IncidentStatus.CLOSED, timezone.now())

    def test_closed_specify_date(self) -> None:
        incident = self.create_incident(
            self.organization,
            title="Test",
            date_started=timezone.now() - timedelta(days=5),
            projects=[self.project],
        )
        date_closed = timezone.now() - timedelta(days=1)
        self.run_test(incident, IncidentStatus.CLOSED, date_closed, date_closed=date_closed)

    def test_all_params(self) -> None:
        incident = self.create_incident()
        self.run_test(incident, IncidentStatus.CLOSED, timezone.now(), user=self.user)


@freeze_time()
class CreateIncidentActivityTest(TestCase, BaseIncidentsTest):
    def test_no_snapshot(self) -> None:
        incident = self.create_incident()
        activity = create_incident_activity(
            incident,
            IncidentActivityType.STATUS_CHANGE,
            value=str(IncidentStatus.CLOSED.value),
            previous_value=str(IncidentStatus.WARNING.value),
        )
        assert activity.incident == incident
        assert activity.type == IncidentActivityType.STATUS_CHANGE.value
        assert activity.value == str(IncidentStatus.CLOSED.value)
        assert activity.previous_value == str(IncidentStatus.WARNING.value)


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
