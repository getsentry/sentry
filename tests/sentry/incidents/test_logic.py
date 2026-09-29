from __future__ import annotations

from datetime import timedelta
from functools import cached_property
from typing import TypedDict
from unittest import mock
from unittest.mock import MagicMock, patch

import orjson
import pytest
import responses
from django.forms import ValidationError
from django.utils import timezone
from slack_sdk.web.slack_response import SlackResponse
from urllib3.exceptions import MaxRetryError, TimeoutError
from urllib3.response import HTTPResponse

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.conf.server import SEER_ANOMALY_DETECTION_STORE_DATA_URL
from sentry.constants import ObjectStatus
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.events import IncidentCreatedEvent, IncidentStatusUpdatedEvent
from sentry.incidents.logic import (
    DEFAULT_ALERT_RULE_RESOLUTION,
    DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION,
    DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER,
    AlertRuleTriggerLabelAlreadyUsedError,
    AlertTarget,
    ChannelLookupTimeoutError,
    InvalidTriggerActionError,
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    create_incident,
    create_incident_activity,
    delete_alert_rule,
    get_alert_resolution,
    translate_aggregate_field,
    update_detector,
    update_incident_status,
)
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleStatus,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
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
from sentry.integrations.discord.client import DISCORD_BASE_URL
from sentry.integrations.discord.utils.channel import ChannelType
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pagerduty.utils import add_service
from sentry.seer.anomaly_detection.store_data import seer_anomaly_detection_connection_pool
from sentry.seer.anomaly_detection.types import StoreDataResponse
from sentry.shared_integrations.exceptions import ApiRateLimitedError, ApiTimeoutError
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import BaseIncidentsTest, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of
from sentry.types.actor import Actor
from sentry.utils import json
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


class CreateAlertRuleTest(TestCase, BaseIncidentsTest):
    def setUp(self) -> None:
        super().setUp()

        class _DynamicMetricAlertSettings(TypedDict):
            name: str
            query: str
            aggregate: str
            time_window: int
            threshold_type: AlertRuleThresholdType
            threshold_period: int
            event_types: list[SnubaQueryEventType.EventType]
            detection_type: AlertRuleDetectionType
            sensitivity: AlertRuleSensitivity
            seasonality: AlertRuleSeasonality

        self.dynamic_metric_alert_settings: _DynamicMetricAlertSettings = {
            "name": "hello",
            "query": "level:error",
            "aggregate": "count(*)",
            "time_window": 30,
            "threshold_type": AlertRuleThresholdType.ABOVE,
            "threshold_period": 1,
            "event_types": [SnubaQueryEventType.EventType.ERROR],
            "detection_type": AlertRuleDetectionType.DYNAMIC,
            "sensitivity": AlertRuleSensitivity.LOW,
            "seasonality": AlertRuleSeasonality.AUTO,
        }

    def test_create_alert_rule(self) -> None:
        name = "hello"
        query = "level:error"
        aggregate = "count(*)"
        time_window = 10
        threshold_type = AlertRuleThresholdType.ABOVE
        resolve_threshold = 10
        threshold_period = 1
        event_types = [SnubaQueryEventType.EventType.ERROR]
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            name,
            query,
            aggregate,
            time_window,
            threshold_type,
            threshold_period,
            resolve_threshold=resolve_threshold,
            event_types=event_types,
        )
        assert alert_rule.name == name
        assert alert_rule.user_id is None
        assert alert_rule.team_id is None
        assert alert_rule.status == AlertRuleStatus.PENDING.value
        if alert_rule.snuba_query.subscriptions.exists():
            assert alert_rule.snuba_query.subscriptions.get().project == self.project
            assert alert_rule.snuba_query.subscriptions.all().count() == 1
        assert alert_rule.snuba_query.type == SnubaQuery.Type.ERROR.value
        assert alert_rule.snuba_query.dataset == Dataset.Events.value
        assert alert_rule.snuba_query.query == query
        assert alert_rule.snuba_query.aggregate == aggregate
        assert alert_rule.snuba_query.time_window == time_window * 60
        assert alert_rule.snuba_query.resolution == DEFAULT_ALERT_RULE_RESOLUTION * 60
        assert set(alert_rule.snuba_query.event_types) == set(event_types)
        assert alert_rule.threshold_type == threshold_type.value
        assert alert_rule.resolve_threshold == resolve_threshold
        assert alert_rule.threshold_period == threshold_period
        assert alert_rule.projects.all().count() == 1

    def test_ignore(self) -> None:
        name = "hello"
        query = "status:unresolved"
        aggregate = "count(*)"
        time_window = 10
        threshold_type = AlertRuleThresholdType.ABOVE
        resolve_threshold = 10
        threshold_period = 1
        event_types = [SnubaQueryEventType.EventType.ERROR]
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            name,
            query,
            aggregate,
            time_window,
            threshold_type,
            threshold_period,
            resolve_threshold=resolve_threshold,
            event_types=event_types,
        )
        assert alert_rule.snuba_query.subscriptions.get().project == self.project
        assert alert_rule.name == name
        assert alert_rule.user_id is None
        assert alert_rule.team_id is None
        assert alert_rule.status == AlertRuleStatus.PENDING.value
        assert alert_rule.snuba_query.subscriptions.all().count() == 1
        assert alert_rule.snuba_query.type == SnubaQuery.Type.ERROR.value
        assert alert_rule.snuba_query.dataset == Dataset.Events.value
        assert alert_rule.snuba_query.query == query
        assert alert_rule.snuba_query.aggregate == aggregate
        assert alert_rule.snuba_query.time_window == time_window * 60
        assert alert_rule.snuba_query.resolution == DEFAULT_ALERT_RULE_RESOLUTION * 60
        assert set(alert_rule.snuba_query.event_types) == set(event_types)
        assert alert_rule.threshold_type == threshold_type.value
        assert alert_rule.resolve_threshold == resolve_threshold
        assert alert_rule.threshold_period == threshold_period

    def test_release_version(self) -> None:
        name = "hello"
        query = "release.version:1.2.3"
        aggregate = "count(*)"
        time_window = 10
        threshold_type = AlertRuleThresholdType.ABOVE
        resolve_threshold = 10
        threshold_period = 1
        event_types = [SnubaQueryEventType.EventType.ERROR]
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            name,
            query,
            aggregate,
            time_window,
            threshold_type,
            threshold_period,
            resolve_threshold=resolve_threshold,
            event_types=event_types,
        )
        assert alert_rule.snuba_query.subscriptions.get().project == self.project
        assert alert_rule.name == name
        assert alert_rule.user_id is None
        assert alert_rule.team_id is None
        assert alert_rule.status == AlertRuleStatus.PENDING.value
        assert alert_rule.snuba_query.subscriptions.all().count() == 1
        assert alert_rule.snuba_query.type == SnubaQuery.Type.ERROR.value
        assert alert_rule.snuba_query.dataset == Dataset.Events.value
        assert alert_rule.snuba_query.query == query
        assert alert_rule.snuba_query.aggregate == aggregate
        assert alert_rule.snuba_query.time_window == time_window * 60
        assert alert_rule.snuba_query.resolution == DEFAULT_ALERT_RULE_RESOLUTION * 60
        assert set(alert_rule.snuba_query.event_types) == set(event_types)
        assert alert_rule.threshold_type == threshold_type.value
        assert alert_rule.resolve_threshold == resolve_threshold
        assert alert_rule.threshold_period == threshold_period

    def test_alert_rule_owner(self) -> None:
        alert_rule_1 = create_alert_rule(
            self.organization,
            [self.project],
            "alert rule 1",
            "level:error",
            "count()",
            1,
            AlertRuleThresholdType.ABOVE,
            1,
            owner=Actor.from_identifier(self.user.id),
        )
        assert alert_rule_1.user_id == self.user.id
        assert alert_rule_1.team_id is None
        alert_rule_2 = create_alert_rule(
            self.organization,
            [self.project],
            "alert rule 2",
            "level:error",
            "count()",
            1,
            AlertRuleThresholdType.ABOVE,
            1,
            owner=Actor.from_identifier(f"team:{self.team.id}"),
        )
        assert alert_rule_2.user_id is None
        assert alert_rule_2.team_id == self.team.id

    def test_comparison_delta(self) -> None:
        comparison_delta = 60
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "alert rule 1",
            "level:error",
            "count()",
            1,
            AlertRuleThresholdType.ABOVE,
            1,
            comparison_delta=comparison_delta,
            detection_type=AlertRuleDetectionType.PERCENT,
        )
        assert alert_rule.snuba_query.subscriptions.get().project == self.project
        assert alert_rule.comparison_delta == comparison_delta * 60
        assert (
            alert_rule.snuba_query.resolution == DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER * 60
        )

    @patch("sentry.incidents.logic.schedule_update_project_config")
    def test_on_demand_metric_alert(self, mocked_schedule_update_project_config: MagicMock) -> None:
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "custom metric alert",
            "transaction.duration:>=1000",
            "count()",
            1,
            AlertRuleThresholdType.ABOVE,
            1,
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Metrics,
        )

        mocked_schedule_update_project_config.assert_called_once_with(alert_rule, [self.project])

    def test_create_alert_resolution_load_shedding(self) -> None:
        time_window = 1440

        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "custom metric alert",
            "transaction.duration:>=1000",
            "count()",
            time_window,
            AlertRuleThresholdType.ABOVE,
            1440,
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Metrics,
        )

        assert (
            alert_rule.snuba_query.resolution
            == DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION[time_window] * 60
        )

    def test_create_alert_load_shedding_comparison(self) -> None:
        time_window = 1440

        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "custom metric alert",
            "transaction.duration:>=1000",
            "count()",
            time_window,
            AlertRuleThresholdType.ABOVE,
            1440,
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Metrics,
            comparison_delta=60,
            detection_type=AlertRuleDetectionType.PERCENT,
        )

        assert (
            alert_rule.snuba_query.resolution
            == DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION[time_window]
            * 60
            * DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER
        )

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_create_alert_rule_anomaly_detection(self, mock_seer_request: MagicMock) -> None:
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        two_weeks_ago = before_now(days=14).replace(hour=10, minute=0, second=0, microsecond=0)
        self.create_event(two_weeks_ago + timedelta(minutes=1))
        self.create_event(two_weeks_ago + timedelta(days=10))

        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            **self.dynamic_metric_alert_settings,
        )

        assert mock_seer_request.call_count == 1
        call_args_str = mock_seer_request.call_args_list[0].kwargs["body"].decode("utf-8")
        assert json.loads(call_args_str)["alert"] == {
            "id": alert_rule.id,
            "source_id": alert_rule.snuba_query.subscriptions.get().id,
            "source_type": 1,
        }
        assert alert_rule.name == self.dynamic_metric_alert_settings["name"]
        assert alert_rule.user_id is None
        assert alert_rule.team_id is None
        assert alert_rule.status == AlertRuleStatus.PENDING.value
        assert alert_rule.sensitivity == self.dynamic_metric_alert_settings["sensitivity"]
        assert alert_rule.seasonality == self.dynamic_metric_alert_settings["seasonality"]
        assert alert_rule.detection_type == AlertRuleDetectionType.DYNAMIC
        assert alert_rule.snuba_query.subscriptions.get().project == self.project
        assert alert_rule.snuba_query.subscriptions.all().count() == 1
        assert alert_rule.snuba_query.type == SnubaQuery.Type.ERROR.value
        assert alert_rule.snuba_query.dataset == Dataset.Events.value
        assert alert_rule.snuba_query.query == self.dynamic_metric_alert_settings["query"]
        assert alert_rule.snuba_query.aggregate == self.dynamic_metric_alert_settings["aggregate"]
        assert (
            alert_rule.snuba_query.time_window
            == self.dynamic_metric_alert_settings["time_window"] * 60
        )
        assert (
            alert_rule.snuba_query.resolution
            == self.dynamic_metric_alert_settings["time_window"] * 60
        )
        assert set(alert_rule.snuba_query.event_types) == set(
            self.dynamic_metric_alert_settings["event_types"]
        )
        assert (
            alert_rule.threshold_type == self.dynamic_metric_alert_settings["threshold_type"].value
        )
        assert alert_rule.threshold_period == self.dynamic_metric_alert_settings["threshold_period"]

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_create_alert_rule_anomaly_detection_not_enough_data(
        self, mock_seer_request: MagicMock
    ) -> None:
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        two_days_ago = before_now(days=2).replace(hour=10, minute=0, second=0, microsecond=0)
        self.create_event(two_days_ago + timedelta(minutes=1))
        self.create_event(two_days_ago + timedelta(days=1))

        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            **self.dynamic_metric_alert_settings,
        )

        assert mock_seer_request.call_count == 1
        assert alert_rule.name == self.dynamic_metric_alert_settings["name"]
        assert alert_rule.status == AlertRuleStatus.NOT_ENOUGH_DATA.value

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_create_alert_rule_anomaly_detection_no_data(
        self, mock_seer_request: MagicMock
    ) -> None:
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        # no events, so we expect _get_start_and_end to return -1, -1
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            **self.dynamic_metric_alert_settings,
        )

        assert mock_seer_request.call_count == 1
        assert alert_rule.name == self.dynamic_metric_alert_settings["name"]
        assert alert_rule.status == AlertRuleStatus.NOT_ENOUGH_DATA.value

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.store_data.logger")
    def test_create_alert_rule_anomaly_detection_seer_timeout_max_retry(
        self, mock_logger, mock_seer_request
    ):
        mock_seer_request.side_effect = TimeoutError

        with pytest.raises(TimeoutError):
            create_alert_rule(
                self.organization,
                [self.project],
                **self.dynamic_metric_alert_settings,
            )

        assert not AlertRule.objects.filter(detection_type=AlertRuleDetectionType.DYNAMIC).exists()
        assert not SnubaQuery.objects.filter(
            aggregate=self.dynamic_metric_alert_settings["aggregate"],
            query=self.dynamic_metric_alert_settings["query"],
            time_window=self.dynamic_metric_alert_settings["time_window"],
        ).exists()
        assert mock_logger.warning.call_count == 1
        assert mock_seer_request.call_count == 1

        mock_seer_request.reset_mock()
        mock_logger.reset_mock()

        mock_seer_request.side_effect = MaxRetryError(
            seer_anomaly_detection_connection_pool, SEER_ANOMALY_DETECTION_STORE_DATA_URL
        )

        with pytest.raises(TimeoutError):
            create_alert_rule(
                self.organization,
                [self.project],
                **self.dynamic_metric_alert_settings,
            )
        assert not AlertRule.objects.filter(detection_type=AlertRuleDetectionType.DYNAMIC).exists()
        assert not SnubaQuery.objects.filter(
            aggregate=self.dynamic_metric_alert_settings["aggregate"],
            query=self.dynamic_metric_alert_settings["query"],
            time_window=self.dynamic_metric_alert_settings["time_window"],
        ).exists()
        assert mock_logger.warning.call_count == 1
        assert mock_seer_request.call_count == 1

    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_create_alert_rule_anomaly_detection_no_feature(
        self, mock_seer_request: MagicMock
    ) -> None:
        with pytest.raises(ResourceDoesNotExist):
            create_alert_rule(
                self.organization,
                [self.project],
                **self.dynamic_metric_alert_settings,
            )
        assert not AlertRule.objects.filter(detection_type=AlertRuleDetectionType.DYNAMIC).exists()
        assert not SnubaQuery.objects.filter(
            aggregate=self.dynamic_metric_alert_settings["aggregate"],
            query=self.dynamic_metric_alert_settings["query"],
            time_window=self.dynamic_metric_alert_settings["time_window"],
        ).exists()
        assert mock_seer_request.call_count == 0


class DeleteAlertRuleTest(TestCase, BaseIncidentsTest):
    def setUp(self) -> None:
        super().setUp()

        class _DynamicMetricAlertSettings(TypedDict):
            name: str
            query: str
            aggregate: str
            time_window: int
            threshold_type: AlertRuleThresholdType
            threshold_period: int
            event_types: list[SnubaQueryEventType.EventType]
            detection_type: AlertRuleDetectionType
            sensitivity: AlertRuleSensitivity
            seasonality: AlertRuleSeasonality

        self.dynamic_metric_alert_settings: _DynamicMetricAlertSettings = {
            "name": "hello",
            "query": "level:error",
            "aggregate": "count(*)",
            "time_window": 30,
            "threshold_type": AlertRuleThresholdType.ABOVE,
            "threshold_period": 1,
            "event_types": [SnubaQueryEventType.EventType.ERROR],
            "detection_type": AlertRuleDetectionType.DYNAMIC,
            "sensitivity": AlertRuleSensitivity.LOW,
            "seasonality": AlertRuleSeasonality.AUTO,
        }

    @cached_property
    def alert_rule(self):
        return self.create_alert_rule()

    @cached_property
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def dynamic_alert_rule(self, mock_seer_request):
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        return self.create_alert_rule(
            self.organization,
            [self.project],
            **self.dynamic_metric_alert_settings,
        )

    def test(self) -> None:
        alert_rule_id = self.alert_rule.id
        with self.tasks():
            delete_alert_rule(self.alert_rule)

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        with self.tasks():
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

    def test_with_incident(self) -> None:
        incident = self.create_incident()
        incident.update(alert_rule=self.alert_rule)
        alert_rule_id = self.alert_rule.id
        with self.tasks():
            delete_alert_rule(self.alert_rule)

        assert AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        incident = Incident.objects.get(id=incident.id)
        assert Incident.objects.filter(id=incident.id, alert_rule=self.alert_rule).exists()

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_with_incident_anomaly_detection_rule(self, mock_seer_request: MagicMock) -> None:
        alert_rule = self.dynamic_alert_rule
        alert_rule_id = alert_rule.id
        incident = self.create_incident()
        incident.update(alert_rule=alert_rule)

        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        with self.tasks():
            delete_alert_rule(alert_rule)

        assert AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        incident = Incident.objects.get(id=incident.id)
        assert Incident.objects.filter(id=incident.id, alert_rule=alert_rule).exists()

        with self.tasks():
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.delete_rule.logger")
    @patch("sentry.incidents.logic.logger")
    def test_with_incident_anomaly_detection_rule_error(
        self, mock_model_logger, mock_seer_logger, mock_seer_request
    ):
        alert_rule = self.dynamic_alert_rule
        alert_rule_id = alert_rule.id
        incident = self.create_incident()
        incident.update(alert_rule=alert_rule)
        query_sub = QuerySubscription.objects.get(snuba_query_id=alert_rule.snuba_query.id)
        mock_seer_request.return_value = HTTPResponse("Bad request", status=500)

        with self.tasks():
            delete_alert_rule(alert_rule)

        assert AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        incident = Incident.objects.get(id=incident.id)
        assert Incident.objects.filter(id=incident.id, alert_rule=alert_rule).exists()

        mock_seer_logger.error.assert_called_with(
            "Error when hitting Seer delete rule data endpoint",
            extra={"response_data": "Bad request", "source_id": query_sub.id},
        )
        mock_model_logger.error.assert_called_with(
            "Call to delete rule data in Seer failed",
            extra={"source_id": query_sub.id},
        )
        assert mock_seer_request.call_count == 1

    @patch("sentry.incidents.logic.schedule_update_project_config")
    def test_on_demand_metric_alert(self, mocked_schedule_update_project_config: MagicMock) -> None:
        alert_rule = self.create_alert_rule(query="transaction.duration:>=100")

        with self.tasks():
            delete_alert_rule(alert_rule)

        mocked_schedule_update_project_config.assert_called_with(alert_rule, [self.project])

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_delete_anomaly_detection_rule(self, mock_seer_request: MagicMock) -> None:
        alert_rule = self.dynamic_alert_rule
        alert_rule_id = alert_rule.id

        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        with self.tasks():
            delete_alert_rule(alert_rule)

        assert AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        with self.tasks():
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.delete_rule.logger")
    @patch("sentry.incidents.logic.logger")
    def test_delete_anomaly_detection_rule_timeout(
        self, mock_model_logger, mock_seer_logger, mock_seer_request
    ):
        alert_rule = self.dynamic_alert_rule
        alert_rule_id = alert_rule.id
        query_sub = QuerySubscription.objects.get(snuba_query_id=alert_rule.snuba_query.id)

        mock_seer_request.side_effect = TimeoutError

        with self.tasks():
            delete_alert_rule(alert_rule)
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        mock_seer_logger.warning.assert_called_with(
            "Timeout error when hitting Seer delete rule data endpoint",
            extra={"source_id": query_sub.id},
        )
        mock_model_logger.error.assert_called_with(
            "Call to delete rule data in Seer failed",
            extra={"source_id": query_sub.id},
        )
        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.delete_rule.logger")
    @patch("sentry.incidents.logic.logger")
    def test_delete_anomaly_detection_rule_error(
        self, mock_model_logger, mock_seer_logger, mock_seer_request
    ):
        alert_rule = self.dynamic_alert_rule
        alert_rule_id = alert_rule.id
        query_sub = QuerySubscription.objects.get(snuba_query_id=alert_rule.snuba_query.id)
        mock_seer_request.return_value = HTTPResponse("Bad request", status=500)

        with self.tasks():
            delete_alert_rule(alert_rule)
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        mock_seer_logger.error.assert_called_with(
            "Error when hitting Seer delete rule data endpoint",
            extra={"response_data": "Bad request", "source_id": query_sub.id},
        )
        mock_model_logger.error.assert_called_with(
            "Call to delete rule data in Seer failed",
            extra={"source_id": query_sub.id},
        )
        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.delete_rule.logger")
    @patch("sentry.incidents.logic.logger")
    def test_delete_anomaly_detection_rule_attribute_error(
        self, mock_model_logger, mock_seer_logger, mock_seer_request
    ):
        alert_rule = self.dynamic_alert_rule
        alert_rule_id = alert_rule.id
        query_sub = QuerySubscription.objects.get(snuba_query_id=alert_rule.snuba_query.id)
        mock_seer_request.return_value = HTTPResponse(None, status=200)  # type:ignore[arg-type]

        with self.tasks():
            delete_alert_rule(alert_rule)
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        mock_seer_logger.exception.assert_called_with(
            "Failed to parse Seer delete rule data response",
            extra={"source_id": query_sub.id},
        )
        mock_model_logger.error.assert_called_with(
            "Call to delete rule data in Seer failed",
            extra={"source_id": query_sub.id},
        )
        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.delete_rule.logger")
    @patch("sentry.incidents.logic.logger")
    def test_delete_anomaly_detection_rule_failure(
        self, mock_model_logger, mock_seer_logger, mock_seer_request
    ):
        alert_rule = self.dynamic_alert_rule
        alert_rule_id = alert_rule.id
        query_sub = QuerySubscription.objects.get(snuba_query_id=alert_rule.snuba_query.id)
        seer_return_value: StoreDataResponse = {"success": False}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        with self.tasks():
            delete_alert_rule(alert_rule)
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        mock_seer_logger.error.assert_called_with(
            "Request to delete alert rule from Seer was unsuccessful",
            extra={"source_id": query_sub.id, "seer_message": None},
        )
        mock_model_logger.error.assert_called_with(
            "Call to delete rule data in Seer failed",
            extra={"source_id": query_sub.id},
        )
        assert mock_seer_request.call_count == 1


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


class CreateAlertRuleTriggerTest(TestCase):
    @cached_property
    def alert_rule(self):
        return self.create_alert_rule()

    def test(self) -> None:
        label = "hello"
        alert_threshold = 1000
        trigger = create_alert_rule_trigger(self.alert_rule, label, alert_threshold)
        assert trigger.label == label
        assert trigger.alert_threshold == alert_threshold

    def test_existing_label(self) -> None:
        name = "uh oh"
        create_alert_rule_trigger(self.alert_rule, name, 100)
        with pytest.raises(AlertRuleTriggerLabelAlreadyUsedError):
            create_alert_rule_trigger(self.alert_rule, name, 100)

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_invalid_threshold_dynamic_alert(self, mock_seer_request: MagicMock) -> None:
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        rule = self.create_alert_rule(
            time_window=15,
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        create_alert_rule_trigger(rule, "yay", 0)
        with pytest.raises(ValidationError):
            create_alert_rule_trigger(rule, "no", 10)


class BaseAlertRuleTriggerActionTest(TestCase):
    @cached_property
    def alert_rule(self):
        return self.create_alert_rule()

    @cached_property
    def trigger(self):
        return create_alert_rule_trigger(self.alert_rule, "hello", 1000)

    def patch_msg_schedule_response(self, channel_id, result_name="channel"):
        if channel_id == "channel_not_found":
            bodydict = {"ok": False, "error": "channel_not_found"}
        else:
            bodydict = {
                "ok": True,
                result_name: channel_id,
                "scheduled_message_id": "Q1298393284",
            }
        return patch(
            "slack_sdk.web.client.WebClient.chat_scheduleMessage",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.scheduleMessage",
                req_args={},
                data=bodydict,
                headers={},
                status_code=200,
            ),
        )

    def patch_msg_delete_scheduled_response(self, channel_id):
        return patch(
            "slack_sdk.web.client.WebClient.chat_deleteScheduledMessage",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.deleteScheduleMessage",
                req_args={},
                data={"ok": True},
                headers={},
                status_code=200,
            ),
        )


class CreateAlertRuleTriggerActionTest(BaseAlertRuleTriggerActionTest):
    def test(self) -> None:
        type = AlertRuleTriggerAction.Type.EMAIL
        target_type = AlertRuleTriggerAction.TargetType.USER
        target_identifier = str(self.user.id)
        action = create_alert_rule_trigger_action(
            self.trigger, type, target_type, target_identifier=target_identifier
        )
        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == target_identifier

    def test_exempt_service(self) -> None:
        service_type = AlertRuleTriggerAction.Type.SENTRY_NOTIFICATION
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC

        with pytest.raises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                trigger=self.trigger,
                type=service_type,
                target_type=target_type,
                target_identifier="1",
            )

    @responses.activate
    def test_slack(self) -> None:
        integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            external_id="2",
            provider="slack",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        type = AlertRuleTriggerAction.Type.SLACK
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "#some_channel"
        channel_id = "s_c"

        with self.patch_msg_schedule_response(channel_id):
            with self.patch_msg_delete_scheduled_response(channel_id):
                action = create_alert_rule_trigger_action(
                    self.trigger,
                    type,
                    target_type,
                    target_identifier=channel_name,
                    integration_id=integration.id,
                )
                assert action.alert_rule_trigger == self.trigger
                assert action.type == type.value
                assert action.target_type == target_type.value
                assert action.target_identifier == channel_id
                assert action.target_display == channel_name
                assert action.integration_id == integration.id

    def test_slack_not_existing(self) -> None:
        integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            external_id="1",
            provider="slack",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        type = AlertRuleTriggerAction.Type.SLACK
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "#some_channel_that_doesnt_exist"
        with self.patch_msg_schedule_response("channel_not_found"):
            with pytest.raises(InvalidTriggerActionError):
                create_alert_rule_trigger_action(
                    self.trigger,
                    type,
                    target_type,
                    target_identifier=channel_name,
                    integration_id=integration.id,
                )

    @responses.activate
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_slack_rate_limiting(self, mock_api_call: MagicMock) -> None:
        """Should handle 429 from Slack on new Metric Alert creation"""
        integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            external_id="1",
            provider="slack",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        type = AlertRuleTriggerAction.Type.SLACK
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "#some_channel"

        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": False, "error": "ratelimited"}).decode(),
            "headers": {},
            "status": 429,
        }

        with self.patch_msg_schedule_response("channel_not_found"):
            with pytest.raises(ApiRateLimitedError):
                create_alert_rule_trigger_action(
                    self.trigger,
                    type,
                    target_type,
                    target_identifier=channel_name,
                    integration_id=integration.id,
                )

    @patch("sentry.integrations.msteams.utils.get_channel_id", return_value="some_id")
    def test_msteams(self, mock_get_channel_id: MagicMock) -> None:
        integration, _ = self.create_provider_integration_for(
            self.organization, self.user, external_id="1", provider="msteams"
        )
        type = AlertRuleTriggerAction.Type.MSTEAMS
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "some_channel"
        channel_id = "some_id"

        action = create_alert_rule_trigger_action(
            self.trigger,
            type,
            target_type,
            target_identifier=channel_name,
            integration_id=integration.id,
        )
        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == channel_id
        assert action.target_display == channel_name
        assert action.integration_id == integration.id

        mock_get_channel_id.assert_called_once_with(
            self.organization, integration.id, "some_channel"
        )

    @patch("sentry.integrations.msteams.utils.get_channel_id", return_value=None)
    def test_msteams_not_existing(self, mock_get_channel_id: MagicMock) -> None:
        integration, _ = self.create_provider_integration_for(
            self.organization, self.user, external_id="1", provider="msteams"
        )
        type = AlertRuleTriggerAction.Type.MSTEAMS
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "some_channel"

        with pytest.raises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=channel_name,
                integration_id=integration.id,
            )

    def test_pagerduty(self) -> None:
        services = [
            {
                "type": "service",
                "integration_key": "PND4F9",
                "service_id": "123",
                "service_name": "hellboi",
            }
        ]
        integration, org_integration = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="pagerduty",
            name="Example PagerDuty",
            external_id="example-pagerduty",
            metadata={"services": services},
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            service = add_service(
                org_integration,
                service_name=services[0]["service_name"],
                integration_key=services[0]["integration_key"],
            )
        type = AlertRuleTriggerAction.Type.PAGERDUTY
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        target_identifier = str(service["id"])
        action = create_alert_rule_trigger_action(
            self.trigger,
            type,
            target_type,
            target_identifier=target_identifier,
            integration_id=integration.id,
        )
        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == str(target_identifier)
        assert action.target_display == "hellboi"
        assert action.integration_id == integration.id

    def test_pagerduty_not_existing(self) -> None:
        integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="pagerduty",
            name="Example PagerDuty",
            external_id="example-pagerduty",
        )
        type = AlertRuleTriggerAction.Type.PAGERDUTY
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        target_identifier = "1"

        with pytest.raises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=target_identifier,
                integration_id=integration.id,
            )

    @responses.activate
    def test_discord(self) -> None:
        guild_id = "example-discord-server"
        metadata = {
            "guild_id": guild_id,
            "name": "Server Name",
            "type": ChannelType.GUILD_TEXT.value,
        }
        integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="discord",
            name="Example Discord",
            external_id=guild_id,
            metadata=metadata,
        )
        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_id = "channel-id"
        responses.add(
            method=responses.GET,
            url=f"{DISCORD_BASE_URL}/channels/{channel_id}",
            json=metadata,
        )
        action = create_alert_rule_trigger_action(
            self.trigger,
            type,
            target_type,
            target_identifier=channel_id,
            integration_id=integration.id,
        )
        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == channel_id
        assert action.target_display == channel_id
        assert action.integration_id == integration.id

    def test_discord_flag_off(self) -> None:
        guild_id = "example-discord-server"
        metadata = {
            "guild_id": guild_id,
            "name": "Server Name",
            "type": ChannelType.GUILD_TEXT.value,
        }
        integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="discord",
            external_id=guild_id,
            metadata=metadata,
        )

        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_id = "channel-id"

        with pytest.raises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=channel_id,
                integration_id=integration.id,
            )

    @patch(
        "sentry.incidents.logic.get_target_identifier_display_for_integration",
        return_value=AlertTarget("123", "test"),
    )
    def test_supported_priority(self, mock_get: MagicMock) -> None:
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)
        priority = "critical"
        action = create_alert_rule_trigger_action(
            trigger,
            AlertRuleTriggerAction.Type.PAGERDUTY,
            AlertRuleTriggerAction.TargetType.SPECIFIC,
            priority=priority,
            target_identifier="123",
        )
        app_config = action.get_single_sentry_app_config()
        assert app_config is not None
        assert app_config["priority"] == priority

    def test_unsupported_priority(self) -> None:
        # doesn't save priority if the action type doesn't use it
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)
        action = create_alert_rule_trigger_action(
            trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.SPECIFIC,
            priority="critical",
        )
        assert action.sentry_app_config is None

    @responses.activate
    def test_opsgenie(self) -> None:
        metadata = {
            "api_key": "1234-ABCD",
            "DISCORD_BASE_URL": "https://api.opsgenie.com/",
            "domain_name": "test-app.app.opsgenie.com",
        }
        team = {"id": "123-id", "team": "cool-team", "integration_key": "1234-5678"}
        integration, org_integration = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="opsgenie",
            name="test-app",
            external_id="test-app",
            metadata=metadata,
        )
        with assume_test_silo_mode_of(OrganizationIntegration):
            org_integration.config = {"team_table": [team]}
            org_integration.save()

        resp_data = {
            "result": "Integration [sentry] is valid",
            "took": 1,
            "requestId": "hello-world",
        }
        responses.add(
            responses.POST,
            url="https://api.opsgenie.com/v2/integrations/authenticate",
            json=resp_data,
        )

        type = AlertRuleTriggerAction.Type.OPSGENIE
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        action = create_alert_rule_trigger_action(
            self.trigger,
            type,
            target_type,
            target_identifier=team["id"],
            integration_id=integration.id,
        )

        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == team["id"]
        assert action.target_display == "cool-team"
        assert action.integration_id == integration.id

    def test_opsgenie_not_existing(self) -> None:
        metadata = {
            "api_key": "1234-ABCD",
            "DISCORD_BASE_URL": "https://api.opsgenie.com/",
            "domain_name": "test-app.app.opsgenie.com",
        }
        integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="opsgenie",
            name="test-app",
            external_id="test-app",
            metadata=metadata,
        )

        type = AlertRuleTriggerAction.Type.OPSGENIE
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        target_identifier = "fake-team-id-123"

        with pytest.raises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=target_identifier,
                integration_id=integration.id,
            )

    @responses.activate
    def test_discord_invalid_channel_id(self) -> None:
        channel_id = "****bad****"
        guild_id = "example-discord-server"
        guild_name = "Server Name"

        integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="discord",
            name="Example Discord",
            external_id=f"{guild_id}",
            metadata={
                "guild_id": f"{guild_id}",
                "name": f"{guild_name}",
                "type": ChannelType.GUILD_TEXT.value,
            },
        )

        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        responses.add(
            method=responses.GET, url=f"{DISCORD_BASE_URL}/channels/{channel_id}", status=404
        )

        with pytest.raises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=channel_id,
                integration_id=integration.id,
            )

    @responses.activate
    def test_discord_bad_response(self) -> None:
        channel_id = "channel-id"
        guild_id = "example-discord-server"
        guild_name = "Server Name"

        integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="discord",
            name="Example Discord",
            external_id=f"{guild_id}",
            metadata={
                "guild_id": f"{guild_id}",
                "name": f"{guild_name}",
                "type": ChannelType.GUILD_TEXT.value,
            },
        )

        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        responses.add(
            method=responses.GET,
            url=f"{DISCORD_BASE_URL}/channels/{channel_id}",
            body="Error",
            status=500,
        )

        with pytest.raises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=channel_id,
                integration_id=integration.id,
            )

    @responses.activate
    def test_discord_no_integration(self) -> None:
        channel_id = "channel-id"
        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        with pytest.raises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=channel_id,
                integration_id=None,
            )

    @responses.activate
    @mock.patch("sentry.integrations.discord.utils.channel.validate_channel_id")
    def test_discord_timeout(self, mock_validate_channel_id: MagicMock) -> None:
        mock_validate_channel_id.side_effect = ApiTimeoutError("Discord channel lookup timed out")

        channel_id = "channel-id"
        guild_id = "example-discord-server"
        guild_name = "Server Name"

        integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="discord",
            name="Example Discord",
            external_id=f"{guild_id}",
            metadata={
                "guild_id": f"{guild_id}",
                "name": f"{guild_name}",
                "type": ChannelType.GUILD_TEXT.value,
            },
        )

        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        responses.add(
            method=responses.GET,
            url=f"{DISCORD_BASE_URL}/channels/{channel_id}",
            json={
                "guild_id": f"{guild_id}",
                "name": f"{guild_name}",
            },
        )

        with pytest.raises(ChannelLookupTimeoutError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=channel_id,
                integration_id=integration.id,
            )

    @responses.activate
    def test_discord_channel_not_in_guild(self) -> None:
        channel_id = "channel-id"
        guild_id = "example-discord-server"
        guild_name = "Server Name"

        integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="discord",
            name="Example Discord",
            external_id=f"{guild_id}",
            metadata={
                "guild_id": f"{guild_id}",
                "name": f"{guild_name}",
                "type": ChannelType.DM.value,
            },
        )

        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        responses.add(
            method=responses.GET,
            url=f"{DISCORD_BASE_URL}/channels/{channel_id}",
            json={
                "guild_id": "other-guild",
                "name": f"{guild_name}",
                "type": ChannelType.DM.value,
            },
        )

        with pytest.raises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=channel_id,
                integration_id=integration.id,
            )

    @responses.activate
    def test_discord_unsupported_type(self) -> None:
        channel_id = "channel-id"
        guild_id = "example-discord-server"
        guild_name = "Server Name"

        integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="discord",
            name="Example Discord",
            external_id=f"{guild_id}",
            metadata={
                "guild_id": f"{guild_id}",
                "name": f"{guild_name}",
                "type": ChannelType.DM.value,
            },
        )

        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        responses.add(
            method=responses.GET,
            url=f"{DISCORD_BASE_URL}/channels/{channel_id}",
            json={
                "guild_id": f"{guild_id}",
                "name": f"{guild_name}",
                "type": ChannelType.DM.value,
            },
        )

        with pytest.raises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=channel_id,
                integration_id=integration.id,
            )


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


class TestCustomMetricAlertRule(TestCase):
    @patch("sentry.incidents.logic.schedule_invalidate_project_config")
    def test_create_alert_rule(self, mocked_schedule_invalidate_project_config: MagicMock) -> None:
        self.create_alert_rule()

        mocked_schedule_invalidate_project_config.assert_not_called()


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
