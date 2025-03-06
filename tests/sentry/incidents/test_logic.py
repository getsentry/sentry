from __future__ import annotations

from datetime import timedelta
from functools import cached_property
from typing import TypedDict
from unittest import mock
from unittest.mock import patch

import orjson
import pytest
import responses
from django.core import mail
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
    CRITICAL_TRIGGER_LABEL,
    DEFAULT_ALERT_RULE_RESOLUTION,
    DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION,
    DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER,
    WARNING_TRIGGER_LABEL,
    WINDOWED_STATS_DATA_POINTS,
    AlertRuleTriggerLabelAlreadyUsedError,
    AlertTarget,
    ChannelLookupTimeoutError,
    GetMetricIssueAggregatesParams,
    InvalidTriggerActionError,
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    create_incident,
    create_incident_activity,
    deduplicate_trigger_actions,
    delete_alert_rule,
    delete_alert_rule_trigger,
    delete_alert_rule_trigger_action,
    disable_alert_rule,
    enable_alert_rule,
    get_actions_for_trigger,
    get_alert_resolution,
    get_available_action_integrations_for_org,
    get_metric_issue_aggregates,
    get_triggers_for_alert_rule,
    snapshot_alert_rule,
    translate_aggregate_field,
    update_alert_rule,
    update_alert_rule_trigger,
    update_alert_rule_trigger_action,
    update_incident_status,
)
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleStatus,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import (
    Incident,
    IncidentActivity,
    IncidentActivityType,
    IncidentProject,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentTrigger,
    IncidentType,
    TriggerStatus,
)
from sentry.integrations.discord.client import DISCORD_BASE_URL
from sentry.integrations.discord.utils.channel import ChannelType
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pagerduty.utils import add_service
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.models.group import GroupStatus
from sentry.seer.anomaly_detection.store_data import seer_anomaly_detection_connection_pool
from sentry.seer.anomaly_detection.types import StoreDataResponse
from sentry.shared_integrations.exceptions import ApiRateLimitedError, ApiTimeoutError
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.testutils.cases import BaseIncidentsTest, BaseMetricsTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of
from sentry.types.actor import Actor

pytestmark = [pytest.mark.sentry_metrics]


class CreateIncidentTest(TestCase):
    @pytest.fixture(autouse=True)
    def _patch_record_event(self):
        with mock.patch("sentry.analytics.base.Analytics.record_event") as self.record_event:
            yield

    def test_simple(self):
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
        event = self.record_event.call_args[0][0]
        assert isinstance(event, IncidentCreatedEvent)
        assert event.data == {
            "organization_id": str(self.organization.id),
            "incident_id": str(incident.id),
            "incident_type": str(IncidentType.ALERT_TRIGGERED.value),
        }


@freeze_time()
class UpdateIncidentStatus(TestCase):
    @pytest.fixture(autouse=True)
    def _patch_record_event(self):
        with mock.patch("sentry.analytics.base.Analytics.record_event") as self.record_event:
            yield

    def get_most_recent_incident_activity(self, incident):
        return IncidentActivity.objects.filter(incident=incident).order_by("-id")[:1].get()

    def test_status_already_set(self):
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
        event = self.record_event.call_args[0][0]
        assert isinstance(event, IncidentStatusUpdatedEvent)
        assert event.data == {
            "organization_id": str(self.organization.id),
            "incident_id": str(incident.id),
            "incident_type": str(incident.type),
            "prev_status": str(prev_status),
            "status": str(incident.status),
        }

    def test_closed(self):
        incident = self.create_incident(
            self.organization, title="Test", date_started=timezone.now(), projects=[self.project]
        )
        self.run_test(incident, IncidentStatus.CLOSED, timezone.now())

    def test_closed_specify_date(self):
        incident = self.create_incident(
            self.organization,
            title="Test",
            date_started=timezone.now() - timedelta(days=5),
            projects=[self.project],
        )
        date_closed = timezone.now() - timedelta(days=1)
        self.run_test(incident, IncidentStatus.CLOSED, date_closed, date_closed=date_closed)

    def test_all_params(self):
        incident = self.create_incident()
        self.run_test(incident, IncidentStatus.CLOSED, timezone.now(), user=self.user)


class BaseIncidentsValidation:
    def validate_result(self, incident, result, expected_results, start, end, windowed_stats):
        # Duration of 300s, but no alert rule
        time_window = incident.alert_rule.snuba_query.time_window if incident.alert_rule else 60
        assert result.rollup == time_window
        expected_start = start if start else incident.date_started - timedelta(seconds=time_window)
        expected_end = end if end else incident.current_end_date + timedelta(seconds=time_window)

        if windowed_stats:
            now = timezone.now()
            expected_end = expected_start + timedelta(
                seconds=time_window * (WINDOWED_STATS_DATA_POINTS / 2)
            )
            expected_start = expected_start - timedelta(
                seconds=time_window * (WINDOWED_STATS_DATA_POINTS / 2)
            )
            if expected_end > now:
                expected_end = now
                expected_start = now - timedelta(seconds=time_window * WINDOWED_STATS_DATA_POINTS)

        assert result.start == expected_start
        assert result.end == expected_end
        assert [r["count"] for r in result.data["data"]] == expected_results


class BaseIncidentEventStatsTest(BaseIncidentsTest, BaseIncidentsValidation):
    @cached_property
    def project_incident(self):
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=1))
        return self.create_incident(
            date_started=self.now - timedelta(minutes=5), query="", projects=[self.project]
        )

    @cached_property
    def group_incident(self):
        fingerprint = "group-1"
        event = self.create_event(self.now - timedelta(minutes=2), fingerprint=fingerprint)
        self.create_event(self.now - timedelta(minutes=2), fingerprint="other-group")
        self.create_event(self.now - timedelta(minutes=1), fingerprint=fingerprint)
        return self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query="",
            projects=[],
            groups=[event.group],
        )


class GetMetricIssueAggregatesTest(TestCase, BaseIncidentsTest):
    def test_projects(self):
        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5), query="", projects=[self.project]
        )
        self.create_event(self.now - timedelta(minutes=1))
        self.create_event(self.now - timedelta(minutes=2), user={"id": 123})
        self.create_event(self.now - timedelta(minutes=2), user={"id": 123})
        self.create_event(self.now - timedelta(minutes=2), user={"id": 124})
        snuba_query = incident.alert_rule.snuba_query
        params = GetMetricIssueAggregatesParams(
            snuba_query=snuba_query,
            date_started=incident.date_started,
            current_end_date=incident.current_end_date,
            organization=incident.organization,
            project_ids=[self.project.id],
        )
        assert get_metric_issue_aggregates(params) == {"count": 4}

    def test_is_unresolved_query(self):
        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query="is:unresolved",
            projects=[self.project],
        )
        event = self.create_event(self.now - timedelta(minutes=1))
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=3))
        self.create_event(self.now - timedelta(minutes=4))

        event.group.update(status=GroupStatus.UNRESOLVED)

        snuba_query = incident.alert_rule.snuba_query
        params = GetMetricIssueAggregatesParams(
            snuba_query=snuba_query,
            date_started=incident.date_started,
            current_end_date=incident.current_end_date,
            organization=incident.organization,
            project_ids=[self.project.id],
        )
        assert get_metric_issue_aggregates(params) == {"count": 4}


class GetCrashRateMetricsIncidentAggregatesTest(TestCase, BaseMetricsTestCase):
    def setUp(self):
        super().setUp()
        self.now = timezone.now().replace(minute=0, second=0, microsecond=0)
        for _ in range(2):
            self.store_session(self.build_session(status="exited"))
        self.dataset = Dataset.Metrics

    def test_sessions(self):
        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=120), query="", projects=[self.project]
        )
        alert_rule = self.create_alert_rule(
            self.organization,
            [self.project],
            query="",
            time_window=1,
            dataset=self.dataset,
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
        )
        incident.update(alert_rule=alert_rule)
        snuba_query = incident.alert_rule.snuba_query
        project_ids = list(
            IncidentProject.objects.filter(incident=incident).values_list("project_id", flat=True)
        )
        params = GetMetricIssueAggregatesParams(
            snuba_query=snuba_query,
            date_started=incident.date_started,
            current_end_date=incident.current_end_date,
            organization=incident.organization,
            project_ids=project_ids,
        )
        incident_aggregates = get_metric_issue_aggregates(params)
        assert "count" in incident_aggregates
        assert incident_aggregates["count"] == 100.0


@freeze_time()
class CreateIncidentActivityTest(TestCase, BaseIncidentsTest):
    def test_no_snapshot(self):
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
    def setUp(self):
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

    def test_create_alert_rule(self):
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

    def test_ignore(self):
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

    def test_release_version(self):
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

    def test_alert_rule_owner(self):
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

    def test_comparison_delta(self):
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

    def test_performance_metric_alert(self):
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "performance alert",
            "",
            "count()",
            1,
            AlertRuleThresholdType.ABOVE,
            1,
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.PerformanceMetrics,
        )
        assert alert_rule.snuba_query.type == SnubaQuery.Type.PERFORMANCE.value
        assert alert_rule.snuba_query.dataset == Dataset.PerformanceMetrics.value

    @patch("sentry.incidents.logic.schedule_update_project_config")
    def test_on_demand_metric_alert(self, mocked_schedule_update_project_config):
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

    def test_create_alert_resolution_load_shedding(self):
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

    def test_create_alert_load_shedding_comparison(self):
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
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_create_alert_rule_anomaly_detection(self, mock_seer_request):
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
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_create_alert_rule_anomaly_detection_not_enough_data(self, mock_seer_request):
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
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_create_alert_rule_anomaly_detection_no_data(self, mock_seer_request):
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
    @with_feature("organizations:anomaly-detection-rollout")
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
    def test_create_alert_rule_anomaly_detection_no_feature(self, mock_seer_request):
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


class UpdateAlertRuleTest(TestCase, BaseIncidentsTest):
    @cached_property
    def alert_rule(self):
        return self.create_alert_rule(name="hello")

    def create_error_event(self, **kwargs):
        two_weeks_ago = before_now(days=14).replace(hour=10, minute=0, second=0, microsecond=0)
        data = {
            "event_id": "a" * 32,
            "message": "super bad",
            "timestamp": two_weeks_ago + timedelta(minutes=1),
            "tags": {"sentry:user": self.user.email},
            "exception": [{"value": "BadError"}],
        }
        data.update(**kwargs)
        self.store_event(
            data=data,
            project_id=self.project.id,
        )

    def test(self):
        name = "uh oh"
        query = "level:warning"
        aggregate = "count_unique(tags[sentry:user])"
        time_window = 50
        threshold_type = AlertRuleThresholdType.BELOW
        threshold_period = 2
        event_types = [SnubaQueryEventType.EventType.ERROR, SnubaQueryEventType.EventType.DEFAULT]

        updated_projects = [self.project, self.create_project(fire_project_created=True)]

        updated_rule = update_alert_rule(
            self.alert_rule,
            projects=updated_projects,
            name=name,
            query=query,
            aggregate=aggregate,
            time_window=time_window,
            threshold_type=threshold_type,
            threshold_period=threshold_period,
            event_types=event_types,
        )
        assert self.alert_rule.id == updated_rule.id
        assert self.alert_rule.name == name
        updated_subscriptions = self.alert_rule.snuba_query.subscriptions.all()
        assert {sub.project for sub in updated_subscriptions} == set(updated_projects)
        for subscription in updated_subscriptions:
            assert subscription.snuba_query.query == query
            assert subscription.snuba_query.aggregate == aggregate
            assert subscription.snuba_query.time_window == int(
                timedelta(minutes=time_window).total_seconds()
            )
        assert self.alert_rule.snuba_query.query == query
        assert self.alert_rule.snuba_query.aggregate == aggregate
        assert self.alert_rule.snuba_query.time_window == time_window * 60
        assert set(self.alert_rule.snuba_query.event_types) == set(event_types)
        assert self.alert_rule.threshold_type == threshold_type.value
        assert self.alert_rule.threshold_period == threshold_period
        assert self.alert_rule.projects.all().count() == 2
        assert self.alert_rule.projects.all()[0] == updated_projects[0]

    @mock.patch(
        "sentry.workflow_engine.migration_helpers.alert_rule.dual_update_migrated_alert_rule"
    )
    def test_dual_update(self, mock_dual_update):
        # test that we call the ACI dual update helpers-will be removed after dual write period ends
        name = "hojicha"

        updated_rule = update_alert_rule(
            self.alert_rule,
            name=name,
        )
        assert self.alert_rule.id == updated_rule.id
        assert self.alert_rule.name == name

        assert mock_dual_update.call_count == 1
        call_args = mock_dual_update.call_args_list[0][0]
        assert call_args[0] == self.alert_rule
        assert call_args[1]["name"] == name

    def test_update_subscription(self):
        old_subscription_id = self.alert_rule.snuba_query.subscriptions.get().subscription_id
        with self.tasks():
            update_alert_rule(self.alert_rule, query="some new query")
        assert (
            old_subscription_id != self.alert_rule.snuba_query.subscriptions.get().subscription_id
        )

    def test_snapshot_alert_rule_with_only_owner(self):
        # Force the alert rule into an invalid state
        AlertRule.objects.filter(id=self.alert_rule.id).update(user_id=None, team_id=None)
        self.alert_rule.refresh_from_db()
        snapshot_alert_rule(self.alert_rule, self.user)

    def test_empty_query(self):
        alert_rule = update_alert_rule(self.alert_rule, query="")
        assert alert_rule.snuba_query.query == ""

    def test_delete_projects(self):
        # Testing delete projects from update
        alert_rule = self.create_alert_rule(
            projects=[self.project, self.create_project(fire_project_created=True)]
        )
        unaffected_alert_rule = self.create_alert_rule(
            projects=[self.project, self.create_project(fire_project_created=True)]
        )
        with self.tasks():
            update_alert_rule(alert_rule, projects=[self.project])
        # NOTE: subscribing alert rule to projects creates a new subscription per project
        subscriptions = alert_rule.snuba_query.subscriptions.all()
        assert subscriptions.count() == 1
        assert alert_rule.snuba_query.subscriptions.get().project == self.project
        assert alert_rule.projects.all().count() == 1
        assert unaffected_alert_rule.projects.all().count() == 2

    def test_new_updated_deleted_projects(self):
        alert_rule = self.create_alert_rule(
            projects=[self.project, self.create_project(fire_project_created=True)]
        )
        query_update = "level:warning"
        new_project = self.create_project(fire_project_created=True)
        project_updates = [self.project, new_project]
        with self.tasks():
            update_alert_rule(alert_rule, projects=project_updates, query=query_update)
        updated_subscriptions = alert_rule.snuba_query.subscriptions.all()
        updated_projects = alert_rule.projects.all()
        assert {sub.project for sub in updated_subscriptions} == set(project_updates)
        assert set(updated_projects) == set(project_updates)
        for sub in updated_subscriptions:
            assert sub.snuba_query.query == query_update

    def test_with_attached_incident(self):
        # A snapshot of the pre-updated rule should be created, and the incidents should also be resolved.
        with self.tasks():
            incident = self.create_incident()
            incident.update(alert_rule=self.alert_rule)
            incident_2 = self.create_incident()
            incident_2.update(alert_rule=self.alert_rule)

            # Give the rule some actions and triggers so we can verify they've been snapshotted correctly.
            trigger = create_alert_rule_trigger(self.alert_rule, "hello", 1000)
            action = create_alert_rule_trigger_action(
                trigger,
                AlertRuleTriggerAction.Type.EMAIL,
                AlertRuleTriggerAction.TargetType.USER,
                target_identifier=str(self.user.id),
            )
            trigger_count = AlertRuleTrigger.objects.all().count()
            action_count = AlertRuleTriggerAction.objects.all().count()

            updated_projects = [self.project, self.create_project(fire_project_created=True)]

            updated_rule = update_alert_rule(
                self.alert_rule,
                projects=updated_projects,
                query="level:warning",
                aggregate="count_unique(tags[sentry:user])",
                time_window=50,
                threshold_period=2,
                threshold_type=AlertRuleThresholdType.BELOW,
                resolve_threshold=1200,
            )

            incident.refresh_from_db()
            incident_2.refresh_from_db()
            rule_snapshot_query = AlertRule.objects_with_snapshots.filter(
                name=self.alert_rule.name
            ).exclude(id=updated_rule.id)
            assert rule_snapshot_query.count() == 1
            rule_snapshot = rule_snapshot_query.get()
            assert rule_snapshot.status == AlertRuleStatus.SNAPSHOT.value

            # Rule snapshot should have properties of the rule before it was updated.
            assert rule_snapshot.id != updated_rule.id
            assert rule_snapshot.snuba_query_id != updated_rule.snuba_query_id
            assert rule_snapshot.name == updated_rule.name
            assert rule_snapshot.snuba_query.query == "level:error"
            assert rule_snapshot.snuba_query.time_window == 600
            assert rule_snapshot.threshold_type == AlertRuleThresholdType.ABOVE.value
            assert rule_snapshot.resolve_threshold is None
            assert rule_snapshot.snuba_query.aggregate == "count()"
            assert rule_snapshot.threshold_period == 1

            for incident in (incident, incident_2):
                # Incidents should now be pointing to the rule snapshot.
                assert incident.alert_rule.id == rule_snapshot.id
                assert incident.alert_rule.name == updated_rule.name
                # Incidents should be resolved
                assert incident.status == IncidentStatus.CLOSED.value

            # Action and trigger counts should double (from 1 to 2)
            assert AlertRuleTrigger.objects.all().count() == trigger_count * 2
            assert AlertRuleTriggerAction.objects.all().count() == action_count * 2

            # Verify actions and triggers have the same properties...and are not the same actions & triggers as the original rule.
            assert AlertRuleTrigger.objects.filter(alert_rule=rule_snapshot).exists()
            trigger_snapshot = AlertRuleTrigger.objects.get(alert_rule=rule_snapshot)
            assert trigger_snapshot.id != trigger.id
            assert trigger_snapshot.label == trigger.label
            assert trigger_snapshot.alert_threshold == trigger.alert_threshold

            assert AlertRuleTriggerAction.objects.filter(
                alert_rule_trigger=trigger_snapshot
            ).exists()
            action_snapshot = AlertRuleTriggerAction.objects.get(
                alert_rule_trigger=trigger_snapshot
            )
            assert action_snapshot.id != action.id
            assert action_snapshot.type == action.type
            assert action_snapshot.target_type == action.target_type
            assert action_snapshot.target_identifier == action.target_identifier
            assert action_snapshot.target_display == action.target_display

    def test_alert_rule_owner(self):
        alert_rule = create_alert_rule(
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
        assert alert_rule.user_id == self.user.id
        assert alert_rule.team_id is None

        update_alert_rule(
            alert_rule=alert_rule,
            owner=Actor.from_identifier(f"team:{self.team.id}"),
        )
        assert alert_rule.team_id == self.team.id
        assert alert_rule.user_id is None

        # Ignore "unreachable" because Mypy sees the `user_id` field declaration on
        # the AlertRule model class and assumes that it's always non-null.
        update_alert_rule(  # type: ignore[unreachable]
            alert_rule=alert_rule,
            owner=Actor.from_identifier(f"user:{self.user.id}"),
        )
        assert alert_rule.user_id == self.user.id
        assert alert_rule.team_id is None

        update_alert_rule(
            alert_rule=alert_rule,
            owner=Actor.from_identifier(self.user.id),
        )
        assert alert_rule.user_id == self.user.id
        assert alert_rule.team_id is None

        update_alert_rule(
            alert_rule=alert_rule,
            name="not updating owner",
        )
        assert alert_rule.user_id == self.user.id
        assert alert_rule.team_id is None

        update_alert_rule(
            alert_rule=alert_rule,
            owner=None,
        )
        assert alert_rule.user_id is None
        assert alert_rule.team_id is None

    def test_comparison_delta(self):
        comparison_delta = 60

        update_alert_rule(self.alert_rule, comparison_delta=comparison_delta)
        assert self.alert_rule.comparison_delta == comparison_delta * 60
        assert (
            self.alert_rule.snuba_query.resolution
            == DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER * 60
        )

        # Should be no change if we don't specify `comparison_delta` for update at all.
        update_alert_rule(self.alert_rule)
        assert self.alert_rule.comparison_delta == comparison_delta * 60
        assert (
            self.alert_rule.snuba_query.resolution
            == DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER * 60
        )

        # Should change if we explicitly set it to None.
        update_alert_rule(self.alert_rule, comparison_delta=None)
        assert self.alert_rule.comparison_delta is None
        assert self.alert_rule.snuba_query.resolution == DEFAULT_ALERT_RULE_RESOLUTION * 60

    def test_performance_metric_alert(self):
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "performance alert",
            "",
            "count()",
            1,
            AlertRuleThresholdType.ABOVE,
            1,
            query_type=SnubaQuery.Type.ERROR,
            dataset=Dataset.Events,
        )
        alert_rule = update_alert_rule(
            alert_rule,
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.PerformanceMetrics,
        )
        assert alert_rule.snuba_query.type == SnubaQuery.Type.PERFORMANCE.value
        assert alert_rule.snuba_query.dataset == Dataset.PerformanceMetrics.value

    @patch("sentry.incidents.logic.schedule_update_project_config")
    def test_on_demand_metric_alert(self, mocked_schedule_update_project_config):
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "custom metric alert",
            "",
            "count()",
            1,
            AlertRuleThresholdType.ABOVE,
            1,
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Metrics,
        )

        mocked_schedule_update_project_config.assert_called_with(alert_rule, [self.project])

        alert_rule = update_alert_rule(
            alert_rule, name="updated alert", query="transaction.duration:>=100"
        )

        mocked_schedule_update_project_config.assert_called_with(alert_rule, None)

    def test_update_alert_load_shedding_on_window(self):
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

        time_window = 90
        updated_alert_rule = update_alert_rule(alert_rule, time_window=time_window)
        assert (
            updated_alert_rule.snuba_query.resolution
            == DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION[time_window] * 60
        )

    def test_update_alert_load_shedding_on_window_with_comparison(self):
        time_window = 1440
        comparison_delta = 60
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
            comparison_delta=comparison_delta,
            detection_type=AlertRuleDetectionType.PERCENT,
        )

        assert (
            alert_rule.snuba_query.resolution
            == DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION[time_window]
            * DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER
            * 60
        )

        time_window = 90
        updated_alert_rule = update_alert_rule(alert_rule, time_window=time_window)

        assert (
            updated_alert_rule.snuba_query.resolution
            == DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION[time_window]
            * DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER
            * 60
        )

    def test_update_alert_load_shedding_on_comparison(self):
        time_window = 1440
        comparison_delta = 60
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
            comparison_delta=comparison_delta,
            detection_type=AlertRuleDetectionType.PERCENT,
        )

        assert alert_rule.snuba_query.resolution == 1800
        updated_alert_rule = update_alert_rule(alert_rule, comparison_delta=90)
        assert (
            updated_alert_rule.snuba_query.resolution
            == DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION[time_window]
            * DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER
            * 60
        )

    def test_update_alert_load_shedding_on_comparison_and_window(self):
        time_window = 1440
        comparison_delta = 60
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
            comparison_delta=comparison_delta,
            detection_type=AlertRuleDetectionType.PERCENT,
        )

        assert alert_rule.snuba_query.resolution == 1800
        time_window = 30
        updated_alert_rule = update_alert_rule(
            alert_rule, time_window=time_window, comparison_delta=90
        )
        assert (
            updated_alert_rule.snuba_query.resolution
            == DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION[time_window]
            * DEFAULT_CMP_ALERT_RULE_RESOLUTION_MULTIPLIER
            * 60
        )

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_update_detection_type(self, mock_seer_delete_request, mock_seer_request):
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        mock_seer_delete_request.return_value = HTTPResponse(
            orjson.dumps(seer_return_value), status=200
        )
        comparison_delta = 60
        # test percent to dynamic
        rule = self.create_alert_rule(
            comparison_delta=comparison_delta,
            detection_type=AlertRuleDetectionType.PERCENT,
        )

        updated_rule = update_alert_rule(
            rule,
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
            time_window=30,
        )

        assert updated_rule.comparison_delta is None
        assert updated_rule.sensitivity == AlertRuleSensitivity.HIGH
        assert updated_rule.seasonality == AlertRuleSeasonality.AUTO
        assert updated_rule.detection_type == AlertRuleDetectionType.DYNAMIC

        # test dynamic to percent
        rule = self.create_alert_rule(
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
            time_window=15,
        )

        updated_rule = update_alert_rule(
            rule, comparison_delta=comparison_delta, detection_type=AlertRuleDetectionType.PERCENT
        )

        assert updated_rule.comparison_delta == comparison_delta * 60
        assert updated_rule.sensitivity is None
        assert updated_rule.seasonality is None
        assert updated_rule.detection_type == AlertRuleDetectionType.PERCENT

        # test static to percent
        rule = self.create_alert_rule()

        updated_rule = update_alert_rule(
            rule, comparison_delta=comparison_delta, detection_type=AlertRuleDetectionType.PERCENT
        )

        assert updated_rule.comparison_delta == comparison_delta * 60
        assert updated_rule.detection_type == AlertRuleDetectionType.PERCENT

        # test static to dynamic
        rule = self.create_alert_rule()

        updated_rule = update_alert_rule(
            rule,
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
            time_window=30,
        )

        assert updated_rule.sensitivity == AlertRuleSensitivity.HIGH
        assert updated_rule.seasonality == AlertRuleSeasonality.AUTO
        assert updated_rule.detection_type == AlertRuleDetectionType.DYNAMIC

        # test percent to static
        rule = self.create_alert_rule(
            comparison_delta=comparison_delta,
            detection_type=AlertRuleDetectionType.PERCENT,
        )

        updated_rule = update_alert_rule(rule, detection_type=AlertRuleDetectionType.STATIC)

        assert updated_rule.comparison_delta is None
        assert updated_rule.sensitivity is None
        assert updated_rule.seasonality is None
        assert updated_rule.detection_type == AlertRuleDetectionType.STATIC

        # test dynamic to static
        rule = self.create_alert_rule(
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
            time_window=15,
        )

        updated_rule = update_alert_rule(rule, detection_type=AlertRuleDetectionType.STATIC)

        assert updated_rule.comparison_delta is None
        assert updated_rule.sensitivity is None
        assert updated_rule.seasonality is None
        assert updated_rule.detection_type == AlertRuleDetectionType.STATIC

        # test dynamic to dynamic
        rule = self.create_alert_rule(
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
            time_window=15,
        )

        updated_rule = update_alert_rule(
            rule, detection_type=AlertRuleDetectionType.DYNAMIC, time_window=30
        )
        assert updated_rule.detection_type == AlertRuleDetectionType.DYNAMIC

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_update_infer_detection_type(self, mock_seer_request):
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        # static to static
        rule = self.create_alert_rule()
        updated_rule = update_alert_rule(rule, time_window=15)
        assert updated_rule.detection_type == AlertRuleDetectionType.STATIC

        # static to percent
        rule = self.create_alert_rule()
        updated_rule = update_alert_rule(rule, comparison_delta=60)
        assert updated_rule.detection_type == AlertRuleDetectionType.PERCENT

        # percent to percent
        rule = self.create_alert_rule(
            comparison_delta=60, detection_type=AlertRuleDetectionType.PERCENT
        )
        updated_rule = update_alert_rule(rule, time_window=15)
        assert updated_rule.detection_type == AlertRuleDetectionType.PERCENT

        # percent to static
        rule = self.create_alert_rule(
            comparison_delta=60, detection_type=AlertRuleDetectionType.PERCENT
        )
        updated_rule = update_alert_rule(rule, comparison_delta=None)
        assert updated_rule.detection_type == AlertRuleDetectionType.STATIC

        # dynamic to percent
        rule = self.create_alert_rule(
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            time_window=60,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )

        updated_rule = update_alert_rule(
            rule, comparison_delta=60, sensitivity=None, seasonality=None
        )

        assert updated_rule.detection_type == AlertRuleDetectionType.PERCENT

        # dynamic to static
        rule = self.create_alert_rule(
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            time_window=60,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )

        updated_rule = update_alert_rule(
            rule, comparison_delta=None, sensitivity=None, seasonality=None
        )

        assert updated_rule.detection_type == AlertRuleDetectionType.STATIC

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_update_dynamic_alerts(self, mock_seer_request):
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        dynamic_rule = self.create_alert_rule(
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            time_window=60,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        snuba_query = SnubaQuery.objects.get(id=dynamic_rule.snuba_query_id)
        assert dynamic_rule.snuba_query.resolution == 60 * 60
        assert mock_seer_request.call_count == 1
        mock_seer_request.reset_mock()
        # update time_window
        update_alert_rule(
            dynamic_rule,
            time_window=30,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        snuba_query.refresh_from_db()
        assert snuba_query.resolution == 30 * 60
        assert mock_seer_request.call_count == 0
        mock_seer_request.reset_mock()
        # update name
        update_alert_rule(dynamic_rule, name="everything is broken")
        dynamic_rule.refresh_from_db()
        assert dynamic_rule.name == "everything is broken"
        assert mock_seer_request.call_count == 0
        mock_seer_request.reset_mock()
        # update query
        update_alert_rule(
            dynamic_rule,
            query="message:*post_process*",
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        assert mock_seer_request.call_count == 1
        snuba_query.refresh_from_db()
        assert snuba_query.query == "message:*post_process*"
        mock_seer_request.reset_mock()
        # update aggregate
        update_alert_rule(
            dynamic_rule,
            aggregate="count_unique(user)",
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        assert mock_seer_request.call_count == 1
        snuba_query.refresh_from_db()
        assert snuba_query.aggregate == "count_unique(user)"

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_update_dynamic_alert_static_to_dynamic(self, mock_seer_request):
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        static_rule = self.create_alert_rule(time_window=30)
        update_alert_rule(
            static_rule,
            time_window=30,
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_update_dynamic_alert_percent_to_dynamic(self, mock_seer_request):
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        percent_rule = self.create_alert_rule(
            comparison_delta=60, time_window=30, detection_type=AlertRuleDetectionType.PERCENT
        )
        update_alert_rule(
            percent_rule,
            time_window=30,
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_update_alert_rule_static_to_dynamic_enough_data(self, mock_seer_request):
        """
        Assert that the status is PENDING if enough data exists.
        """
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        two_weeks_ago = before_now(days=14).replace(hour=10, minute=0, second=0, microsecond=0)
        self.create_event(two_weeks_ago + timedelta(minutes=1))
        self.create_event(two_weeks_ago + timedelta(days=10))

        alert_rule = self.create_alert_rule(
            time_window=30, detection_type=AlertRuleDetectionType.STATIC
        )
        update_alert_rule(
            alert_rule,
            time_window=30,
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        assert mock_seer_request.call_count == 1
        assert alert_rule.status == AlertRuleStatus.PENDING.value

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_update_dynamic_alert_not_enough_to_pending(self, mock_seer_request):
        """
        Update a dynamic rule's aggregate so the rule's status changes from not enough data to enough/pending
        """
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        dynamic_rule = self.create_alert_rule(
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            time_window=60,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        assert mock_seer_request.call_count == 1
        assert dynamic_rule.status == AlertRuleStatus.NOT_ENOUGH_DATA.value
        mock_seer_request.reset_mock()

        two_weeks_ago = before_now(days=14).replace(hour=10, minute=0, second=0, microsecond=0)
        self.create_error_event(timestamp=(two_weeks_ago + timedelta(minutes=1)).isoformat())
        self.create_error_event(
            timestamp=(two_weeks_ago + timedelta(days=10)).isoformat()
        )  # 4 days ago

        # update aggregate
        update_alert_rule(
            dynamic_rule,
            aggregate="count_unique(user)",
            time_window=60,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        assert mock_seer_request.call_count == 1
        assert dynamic_rule.status == AlertRuleStatus.PENDING.value

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_update_dynamic_alert_pending_to_not_enough(self, mock_seer_request):
        """
        Update a dynamic rule's aggregate so the rule's status changes from enough/pending to not enough data
        """
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        two_weeks_ago = before_now(days=14).replace(hour=10, minute=0, second=0, microsecond=0)
        self.create_error_event(timestamp=(two_weeks_ago + timedelta(minutes=1)).isoformat())
        self.create_error_event(
            timestamp=(two_weeks_ago + timedelta(days=10)).isoformat()
        )  # 4 days ago

        dynamic_rule = self.create_alert_rule(
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            time_window=60,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        assert mock_seer_request.call_count == 1
        assert dynamic_rule.status == AlertRuleStatus.PENDING.value

        mock_seer_request.reset_mock()

        # update aggregate
        update_alert_rule(
            dynamic_rule,
            aggregate="p95(measurements.fid)",  # first input delay data we don't have stored
            dataset=Dataset.Transactions,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            query="",
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        assert mock_seer_request.call_count == 1
        assert dynamic_rule.status == AlertRuleStatus.NOT_ENOUGH_DATA.value

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_update_alert_rule_static_to_dynamic_not_enough_data(self, mock_seer_request):
        """
        Assert that the status is NOT_ENOUGH_DATA if we don't have 7 days of data.
        """
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        two_days_ago = before_now(days=2).replace(hour=10, minute=0, second=0, microsecond=0)
        self.create_event(two_days_ago + timedelta(minutes=1))
        self.create_event(two_days_ago + timedelta(days=1))

        alert_rule = self.create_alert_rule(
            time_window=30, detection_type=AlertRuleDetectionType.STATIC
        )
        update_alert_rule(
            alert_rule,
            time_window=30,
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        assert mock_seer_request.call_count == 1
        assert alert_rule.status == AlertRuleStatus.NOT_ENOUGH_DATA.value

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_update_alert_rule_dynamic_to_static_status(self, mock_seer_request):
        """
        Assert that the alert rule status changes to PENDING if we switch from a dynamic alert to another type of alert.
        """
        # just setting up an alert
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        two_days_ago = before_now(days=2).replace(hour=10, minute=0, second=0, microsecond=0)
        self.create_event(two_days_ago + timedelta(minutes=1))
        self.create_event(two_days_ago + timedelta(days=1))

        alert_rule = self.create_alert_rule()
        update_alert_rule(
            alert_rule,
            time_window=30,
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        assert mock_seer_request.call_count == 1
        assert alert_rule.status == AlertRuleStatus.NOT_ENOUGH_DATA.value

        # okay, here's the test :)
        update_alert_rule(
            alert_rule,
            sensitivity=None,
            seasonality=None,
            detection_type=AlertRuleDetectionType.STATIC,
        )
        assert alert_rule.status == AlertRuleStatus.PENDING.value

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.store_data.logger")
    def test_update_alert_rule_anomaly_detection_seer_timeout_max_retry(
        self, mock_logger, mock_seer_request
    ):
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        dynamic_rule = self.create_alert_rule(
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            time_window=60,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        assert mock_seer_request.call_count == 1
        mock_seer_request.reset_mock()

        mock_seer_request.side_effect = TimeoutError

        with pytest.raises(TimeoutError):
            # attempt to update query
            update_alert_rule(
                dynamic_rule,
                time_window=30,
                query="message:*post_process*",
                detection_type=AlertRuleDetectionType.DYNAMIC,
                sensitivity=AlertRuleSensitivity.HIGH,
                seasonality=AlertRuleSeasonality.AUTO,
            )

        assert mock_logger.warning.call_count == 1
        assert mock_seer_request.call_count == 1

        mock_seer_request.reset_mock()
        mock_logger.reset_mock()

        mock_seer_request.side_effect = MaxRetryError(
            seer_anomaly_detection_connection_pool, SEER_ANOMALY_DETECTION_STORE_DATA_URL
        )
        with pytest.raises(TimeoutError):
            # attempt to update query
            update_alert_rule(
                dynamic_rule,
                time_window=30,
                query="message:*post_process*",
                detection_type=AlertRuleDetectionType.DYNAMIC,
                sensitivity=AlertRuleSensitivity.HIGH,
                seasonality=AlertRuleSeasonality.AUTO,
            )

        assert mock_logger.warning.call_count == 1
        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.store_data.logger")
    def test_update_alert_rule_static_to_anomaly_detection_seer_timeout(
        self, mock_logger, mock_seer_request
    ):
        mock_seer_request.side_effect = MaxRetryError(
            seer_anomaly_detection_connection_pool, SEER_ANOMALY_DETECTION_STORE_DATA_URL
        )
        static_rule = self.create_alert_rule(time_window=30)
        with pytest.raises(TimeoutError):
            update_alert_rule(
                static_rule,
                time_window=30,
                sensitivity=AlertRuleSensitivity.HIGH,
                seasonality=AlertRuleSeasonality.AUTO,
                detection_type=AlertRuleDetectionType.DYNAMIC,
            )
        static_rule.refresh_from_db()
        assert static_rule.detection_type == AlertRuleDetectionType.STATIC

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_update_alert_rule_dynamic_to_static_delete_call(
        self, mock_store_request, mock_delete_request
    ):
        seer_return_value = {"success": True}
        mock_store_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        mock_delete_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        alert_rule = self.create_alert_rule(
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            time_window=60,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )

        update_alert_rule(alert_rule, detection_type=AlertRuleDetectionType.STATIC)

        assert mock_delete_request.call_count == 1

    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_update_alert_rule_anomaly_detection_no_feature(self, mock_seer_request):
        static_rule = self.create_alert_rule(time_window=30)

        with pytest.raises(ResourceDoesNotExist):
            update_alert_rule(
                static_rule,
                time_window=30,
                sensitivity=AlertRuleSensitivity.HIGH,
                seasonality=AlertRuleSeasonality.AUTO,
                detection_type=AlertRuleDetectionType.DYNAMIC,
            )

        assert mock_seer_request.call_count == 0
        assert static_rule.detection_type == AlertRuleDetectionType.STATIC

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_update_invalid_time_window(self, mock_seer_request):
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        rule = self.create_alert_rule(
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
            time_window=15,
        )

        with pytest.raises(ValidationError):
            update_alert_rule(rule, detection_type=AlertRuleDetectionType.DYNAMIC, time_window=300)


class DeleteAlertRuleTest(TestCase, BaseIncidentsTest):
    def setUp(self):
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

    def test(self):
        alert_rule_id = self.alert_rule.id
        with self.tasks():
            delete_alert_rule(self.alert_rule)

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        with self.tasks():
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

    def test_with_incident(self):
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
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_with_incident_anomaly_detection_rule(self, mock_seer_request):
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
    @with_feature("organizations:anomaly-detection-rollout")
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
        mock_seer_request.return_value = HTTPResponse("Bad request", status=500)

        with self.tasks():
            delete_alert_rule(alert_rule)

        assert AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        incident = Incident.objects.get(id=incident.id)
        assert Incident.objects.filter(id=incident.id, alert_rule=alert_rule).exists()

        mock_seer_logger.error.assert_called_with(
            "Error when hitting Seer delete rule data endpoint",
            extra={"response_data": "Bad request", "rule_id": alert_rule_id},
        )
        mock_model_logger.error.assert_called_with(
            "Call to delete rule data in Seer failed",
            extra={"rule_id": alert_rule_id},
        )
        assert mock_seer_request.call_count == 1

    @patch("sentry.incidents.logic.schedule_update_project_config")
    def test_on_demand_metric_alert(self, mocked_schedule_update_project_config):
        alert_rule = self.create_alert_rule(query="transaction.duration:>=100")

        with self.tasks():
            delete_alert_rule(alert_rule)

        mocked_schedule_update_project_config.assert_called_with(alert_rule, [self.project])

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_delete_anomaly_detection_rule(self, mock_seer_request):
        alert_rule = self.dynamic_alert_rule
        alert_rule_id = alert_rule.id

        with self.tasks():
            delete_alert_rule(alert_rule)

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        with self.tasks():
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.delete_rule.logger")
    @patch("sentry.incidents.models.alert_rule.logger")
    def test_delete_anomaly_detection_rule_timeout(
        self, mock_model_logger, mock_seer_logger, mock_seer_request
    ):
        alert_rule = self.dynamic_alert_rule
        alert_rule_id = alert_rule.id

        with self.tasks():
            delete_alert_rule(alert_rule)

        mock_seer_request.side_effect = TimeoutError

        with self.tasks():
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        mock_seer_logger.warning.assert_called_with(
            "Timeout error when hitting Seer delete rule data endpoint",
            extra={"rule_id": alert_rule_id},
        )
        mock_model_logger.error.assert_called_with(
            "Call to delete rule data in Seer failed",
            extra={"rule_id": alert_rule_id},
        )
        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.delete_rule.logger")
    @patch("sentry.incidents.models.alert_rule.logger")
    def test_delete_anomaly_detection_rule_error(
        self, mock_model_logger, mock_seer_logger, mock_seer_request
    ):
        alert_rule = self.dynamic_alert_rule
        alert_rule_id = alert_rule.id

        with self.tasks():
            delete_alert_rule(alert_rule)

        mock_seer_request.return_value = HTTPResponse("Bad request", status=500)

        with self.tasks():
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        mock_seer_logger.error.assert_called_with(
            "Error when hitting Seer delete rule data endpoint",
            extra={"response_data": "Bad request", "rule_id": alert_rule_id},
        )
        mock_model_logger.error.assert_called_with(
            "Call to delete rule data in Seer failed",
            extra={"rule_id": alert_rule_id},
        )
        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.delete_rule.logger")
    @patch("sentry.incidents.models.alert_rule.logger")
    def test_delete_anomaly_detection_rule_attribute_error(
        self, mock_model_logger, mock_seer_logger, mock_seer_request
    ):
        alert_rule = self.dynamic_alert_rule
        alert_rule_id = alert_rule.id

        with self.tasks():
            delete_alert_rule(alert_rule)

        mock_seer_request.return_value = HTTPResponse(None, status=200)  # type:ignore[arg-type]

        with self.tasks():
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        mock_seer_logger.exception.assert_called_with(
            "Failed to parse Seer delete rule data response",
            extra={"rule_id": alert_rule_id},
        )
        mock_model_logger.error.assert_called_with(
            "Call to delete rule data in Seer failed",
            extra={"rule_id": alert_rule_id},
        )
        assert mock_seer_request.call_count == 1

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch("sentry.seer.anomaly_detection.delete_rule.logger")
    @patch("sentry.incidents.models.alert_rule.logger")
    def test_delete_anomaly_detection_rule_failure(
        self, mock_model_logger, mock_seer_logger, mock_seer_request
    ):
        alert_rule = self.dynamic_alert_rule
        alert_rule_id = alert_rule.id

        with self.tasks():
            delete_alert_rule(alert_rule)

        seer_return_value: StoreDataResponse = {"success": False}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        with self.tasks():
            run_scheduled_deletions()

        assert not AlertRule.objects.filter(id=alert_rule_id).exists()
        assert not AlertRule.objects_with_snapshots.filter(id=alert_rule_id).exists()

        mock_seer_logger.error.assert_called_with(
            "Request to delete alert rule from Seer was unsuccessful",
            extra={"rule_id": alert_rule_id},
        )
        mock_model_logger.error.assert_called_with(
            "Call to delete rule data in Seer failed",
            extra={"rule_id": alert_rule_id},
        )
        assert mock_seer_request.call_count == 1


class EnableAlertRuleTest(TestCase, BaseIncidentsTest):
    @cached_property
    def alert_rule(self):
        return self.create_alert_rule()

    def test(self):
        with self.tasks():
            disable_alert_rule(self.alert_rule)
            alert_rule = AlertRule.objects.get(id=self.alert_rule.id)
            assert alert_rule.status == AlertRuleStatus.DISABLED.value
            for subscription in alert_rule.snuba_query.subscriptions.all():
                assert subscription.status == QuerySubscription.Status.DISABLED.value

            enable_alert_rule(self.alert_rule)
            alert_rule = AlertRule.objects.get(id=self.alert_rule.id)
            assert alert_rule.status == AlertRuleStatus.PENDING.value
            for subscription in alert_rule.snuba_query.subscriptions.all():
                assert subscription.status == QuerySubscription.Status.ACTIVE.value


class DisableAlertRuleTest(TestCase, BaseIncidentsTest):
    @cached_property
    def alert_rule(self):
        return self.create_alert_rule()

    def test(self):
        with self.tasks():
            disable_alert_rule(self.alert_rule)
            alert_rule = AlertRule.objects.get(id=self.alert_rule.id)
            assert alert_rule.status == AlertRuleStatus.DISABLED.value
            for subscription in alert_rule.snuba_query.subscriptions.all():
                assert subscription.status == QuerySubscription.Status.DISABLED.value


class CreateAlertRuleTriggerTest(TestCase):
    @cached_property
    def alert_rule(self):
        return self.create_alert_rule()

    def test(self):
        label = "hello"
        alert_threshold = 1000
        trigger = create_alert_rule_trigger(self.alert_rule, label, alert_threshold)
        assert trigger.label == label
        assert trigger.alert_threshold == alert_threshold

    def test_existing_label(self):
        name = "uh oh"
        create_alert_rule_trigger(self.alert_rule, name, 100)
        with pytest.raises(AlertRuleTriggerLabelAlreadyUsedError):
            create_alert_rule_trigger(self.alert_rule, name, 100)

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_invalid_threshold_dynamic_alert(self, mock_seer_request):
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


class UpdateAlertRuleTriggerTest(TestCase):
    @cached_property
    def alert_rule(self):
        return self.create_alert_rule()

    def test(self):
        trigger = create_alert_rule_trigger(self.alert_rule, "hello", 1000)

        label = "uh oh"
        alert_threshold = 2000
        trigger = update_alert_rule_trigger(trigger, label=label, alert_threshold=alert_threshold)
        assert trigger.label == label
        assert trigger.alert_threshold == alert_threshold

    @mock.patch(
        "sentry.workflow_engine.migration_helpers.alert_rule.dual_update_migrated_alert_rule_trigger"
    )
    def test_dual_update(self, mock_dual_update):
        # test that we can call the ACI dual update helpers—will be removed after dual write period ends
        trigger = create_alert_rule_trigger(self.alert_rule, "hello", 1000)

        label = "matcha"
        trigger = update_alert_rule_trigger(trigger, label=label)
        assert trigger.label == label

        assert mock_dual_update.call_count == 1
        call_args = mock_dual_update.call_args_list[0][0]
        assert call_args[0] == trigger
        assert call_args[1]["label"] == label

    def test_name_used(self):
        label = "uh oh"
        create_alert_rule_trigger(self.alert_rule, label, 1000)
        trigger = create_alert_rule_trigger(self.alert_rule, "something else", 1000)
        with pytest.raises(AlertRuleTriggerLabelAlreadyUsedError):
            update_alert_rule_trigger(trigger, label=label)

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_invalid_threshold_dynamic_alert(self, mock_seer_request):
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        rule = self.create_alert_rule(
            time_window=15,
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            detection_type=AlertRuleDetectionType.DYNAMIC,
        )
        trigger = create_alert_rule_trigger(rule, "yay", 0)
        with pytest.raises(ValidationError):
            update_alert_rule_trigger(trigger, alert_threshold=10)


class DeleteAlertRuleTriggerTest(TestCase):
    def test(self):
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)
        trigger_id = trigger.id
        delete_alert_rule_trigger(trigger)
        assert not AlertRuleTrigger.objects.filter(id=trigger_id).exists()


class GetTriggersForAlertRuleTest(TestCase):
    def test(self):
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)
        assert get_triggers_for_alert_rule(alert_rule).get() == trigger


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
    def test(self):
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

    def test_exempt_service(self):
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
    def test_slack(self):
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

    def test_slack_not_existing(self):
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
    def test_slack_rate_limiting(self, mock_api_call):
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
    def test_msteams(self, mock_get_channel_id):
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
    def test_msteams_not_existing(self, mock_get_channel_id):
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

    def test_pagerduty(self):
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

    def test_pagerduty_not_existing(self):
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
    def test_discord(self):
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

    def test_discord_flag_off(self):
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
    def test_supported_priority(self, mock_get):
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

    def test_unsupported_priority(self):
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


class UpdateAlertRuleTriggerAction(BaseAlertRuleTriggerActionTest):
    @cached_property
    def action(self):
        return create_alert_rule_trigger_action(
            self.trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )

    def test(self):
        type = AlertRuleTriggerAction.Type.EMAIL
        target_type = AlertRuleTriggerAction.TargetType.TEAM
        target_identifier = str(self.team.id)
        update_alert_rule_trigger_action(
            self.action, type=type, target_type=target_type, target_identifier=target_identifier
        )
        assert self.action.type == type.value
        assert self.action.target_type == target_type.value
        assert self.action.target_identifier == target_identifier

    @mock.patch(
        "sentry.workflow_engine.migration_helpers.alert_rule.dual_update_migrated_alert_rule_trigger_action"
    )
    def test_dual_update(self, mock_dual_update):
        # test that we call the ACI dual update helpers—will be removed after dual wrie period ends
        type = AlertRuleTriggerAction.Type.EMAIL
        update_alert_rule_trigger_action(self.action, type=type)
        assert self.action.type == type.value

        assert mock_dual_update.call_count == 1
        call_args = mock_dual_update.call_args_list[0][0]
        assert call_args[0] == self.action
        assert call_args[1]["type"] == type

    @responses.activate
    def test_slack(self):
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
        channel_id = "s_c"

        with self.patch_msg_schedule_response(channel_id):
            with self.patch_msg_delete_scheduled_response(channel_id):
                action = update_alert_rule_trigger_action(
                    self.action,
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

    def test_slack_not_existing(self):
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
                update_alert_rule_trigger_action(
                    self.action,
                    type,
                    target_type,
                    target_identifier=channel_name,
                    integration_id=integration.id,
                )

    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_slack_rate_limiting(self, mock_api_call):
        """Should handle 429 from Slack on existing Metric Alert update"""
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
                update_alert_rule_trigger_action(
                    self.action,
                    type,
                    target_type,
                    target_identifier=channel_name,
                    integration_id=integration.id,
                )

    @patch("sentry.integrations.msteams.utils.get_channel_id", return_value="some_id")
    def test_msteams(self, mock_get_channel_id):
        integration, _ = self.create_provider_integration_for(
            self.organization, self.user, external_id="1", provider="msteams"
        )
        type = AlertRuleTriggerAction.Type.MSTEAMS
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "some_channel"
        channel_id = "some_id"

        action = update_alert_rule_trigger_action(
            self.action,
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
    def test_msteams_not_existing(self, mock_get_channel_id):
        integration, _ = self.create_provider_integration_for(
            self.organization, self.user, external_id="1", provider="msteams"
        )
        type = AlertRuleTriggerAction.Type.MSTEAMS
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "some_channel"

        with pytest.raises(InvalidTriggerActionError):
            update_alert_rule_trigger_action(
                self.action,
                type,
                target_type,
                target_identifier=channel_name,
                integration_id=integration.id,
            )

    def test_pagerduty(self):
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
        target_identifier = service["id"]
        action = update_alert_rule_trigger_action(
            self.action,
            type,
            target_type,
            target_identifier=str(target_identifier),
            integration_id=integration.id,
        )

        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == target_identifier
        assert action.target_display == "hellboi"
        assert action.integration_id == integration.id

    def test_pagerduty_not_existing(self):
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
            update_alert_rule_trigger_action(
                self.action,
                type,
                target_type,
                target_identifier=target_identifier,
                integration_id=integration.id,
            )

    @responses.activate
    def test_opsgenie(self):
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
        action = update_alert_rule_trigger_action(
            self.action,
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

    def test_opsgenie_not_existing(self):
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
            update_alert_rule_trigger_action(
                self.action,
                type,
                target_type,
                target_identifier=target_identifier,
                integration_id=integration.id,
            )

    @responses.activate
    def test_discord(self):
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
                "type": ChannelType.GUILD_TEXT.value,
            },
        )

        action = update_alert_rule_trigger_action(
            self.action,
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

    @responses.activate
    def test_discord_invalid_channel_id(self):
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
            update_alert_rule_trigger_action(
                self.action,
                type,
                target_type,
                target_identifier=channel_id,
                integration_id=integration.id,
            )

    @responses.activate
    def test_discord_bad_response(self):
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
            update_alert_rule_trigger_action(
                self.action,
                type,
                target_type,
                target_identifier=channel_id,
                integration_id=integration.id,
            )

    @responses.activate
    def test_discord_no_integration(self):
        channel_id = "channel-id"
        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        with pytest.raises(InvalidTriggerActionError):
            update_alert_rule_trigger_action(
                self.action,
                type,
                target_type,
                target_identifier=channel_id,
                integration_id=None,
            )

    @responses.activate
    @mock.patch("sentry.integrations.discord.utils.channel.validate_channel_id")
    def test_discord_timeout(self, mock_validate_channel_id):
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
            update_alert_rule_trigger_action(
                self.action,
                type,
                target_type,
                target_identifier=channel_id,
                integration_id=integration.id,
            )

    @responses.activate
    def test_discord_channel_not_in_guild(self):
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
            update_alert_rule_trigger_action(
                self.action,
                type,
                target_type,
                target_identifier=channel_id,
                integration_id=integration.id,
            )

    @responses.activate
    def test_discord_unsupported_type(self):
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
            update_alert_rule_trigger_action(
                self.action,
                type,
                target_type,
                target_identifier=channel_id,
                integration_id=integration.id,
            )

    @responses.activate
    def test_supported_priority(self):
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
        priority = "P1"
        action = update_alert_rule_trigger_action(
            self.action,
            type,
            target_type,
            target_identifier=team["id"],
            integration_id=integration.id,
            priority=priority,
        )

        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == team["id"]
        assert action.target_display == "cool-team"
        assert action.integration_id == integration.id
        app_config = action.get_single_sentry_app_config()
        assert app_config is not None
        assert app_config["priority"] == priority  # priority stored in config

    @patch("sentry.integrations.msteams.utils.get_channel_id", return_value="some_id")
    def test_unsupported_priority(self, mock_get_channel_id):
        integration, _ = self.create_provider_integration_for(
            self.organization, self.user, external_id="1", provider="msteams"
        )
        type = AlertRuleTriggerAction.Type.MSTEAMS
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "some_channel"
        channel_id = "some_id"

        action = update_alert_rule_trigger_action(
            self.action,
            type,
            target_type,
            target_identifier=channel_name,
            integration_id=integration.id,
            priority="critical",
        )
        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == channel_id
        assert action.target_display == channel_name
        assert action.integration_id == integration.id
        assert action.sentry_app_config is None  # priority is not stored inside


class DeleteAlertRuleTriggerAction(BaseAlertRuleTriggerActionTest):
    @cached_property
    def action(self):
        return create_alert_rule_trigger_action(
            self.trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )

    def test(self):
        action_id = self.action.id
        delete_alert_rule_trigger_action(self.action)
        with pytest.raises(AlertRuleTriggerAction.DoesNotExist):
            AlertRuleTriggerAction.objects.get(id=action_id)


class GetActionsForTriggerTest(BaseAlertRuleTriggerActionTest):
    def test(self):
        assert list(get_actions_for_trigger(self.trigger)) == []
        action = create_alert_rule_trigger_action(
            self.trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )
        assert list(get_actions_for_trigger(self.trigger)) == [action]


class GetAvailableActionIntegrationsForOrgTest(TestCase):
    def test_none(self):
        assert list(get_available_action_integrations_for_org(self.organization)) == []

    def test_unregistered(self):
        integration, _ = self.create_provider_integration_for(
            self.organization, user=None, external_id="1", provider="something_random"
        )
        assert list(get_available_action_integrations_for_org(self.organization)) == []

    def test_registered(self):
        integration, _ = self.create_provider_integration_for(
            self.organization, user=None, external_id="1", provider="slack"
        )
        assert list(get_available_action_integrations_for_org(self.organization)) == [
            serialize_integration(integration)
        ]

    def test_mixed(self):
        integration, _ = self.create_provider_integration_for(
            self.organization, user=None, external_id="1", provider="slack"
        )
        other_integration, _ = self.create_provider_integration_for(
            self.organization, user=None, external_id="12345", provider="random"
        )
        assert list(get_available_action_integrations_for_org(self.organization)) == [
            serialize_integration(integration)
        ]

    def test_disabled_integration(self):
        integration, _ = self.create_provider_integration_for(
            self.organization,
            user=None,
            external_id="1",
            provider="slack",
            status=ObjectStatus.DISABLED,
        )
        assert list(get_available_action_integrations_for_org(self.organization)) == []

    def test_disabled_org_integration(self):
        integration, org_integration = self.create_provider_integration_for(
            self.organization, user=None, external_id="1", provider="slack"
        )
        with assume_test_silo_mode_of(OrganizationIntegration):
            org_integration.update(status=ObjectStatus.DISABLED)
        assert list(get_available_action_integrations_for_org(self.organization)) == []


class MetricTranslationTest(TestCase):
    def test_simple(self):
        aggregate = "count_unique(user)"
        translated = translate_aggregate_field(aggregate)
        assert translated == "count_unique(tags[sentry:user])"

        # Make sure it doesn't double encode:
        translated_2 = translate_aggregate_field(translated)
        assert translated_2 == "count_unique(tags[sentry:user])"

    def test_reverse(self):
        aggregate = "count_unique(tags[sentry:user])"
        translated = translate_aggregate_field(aggregate, reverse=True)
        assert translated == "count_unique(user)"

        # Make sure it doesn't do anything wonky running twice:
        translated_2 = translate_aggregate_field(translated, reverse=True)
        assert translated_2 == "count_unique(user)"


class TriggerActionTest(TestCase):
    @cached_property
    def user(self):
        return self.create_user("test@test.com")

    @cached_property
    def team(self):
        team = self.create_team()
        self.create_team_membership(team, user=self.user)
        return team

    @cached_property
    def project(self):
        return self.create_project(teams=[self.team], name="foo")

    @cached_property
    def other_project(self):
        return self.create_project(teams=[self.team], name="other")

    @cached_property
    def rule(self):
        rule = self.create_alert_rule(
            projects=[self.project, self.other_project],
            name="some rule",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )
        # Make sure the trigger exists
        trigger = create_alert_rule_trigger(rule, "hi", 100)
        create_alert_rule_trigger_action(
            trigger=trigger,
            type=AlertRuleTriggerAction.Type.EMAIL,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )
        # Duplicate action that should be deduped
        create_alert_rule_trigger_action(
            trigger=trigger,
            type=AlertRuleTriggerAction.Type.EMAIL,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )
        return rule

    @cached_property
    def trigger(self):
        return self.rule.alertruletrigger_set.get()

    def test_rule_updated(self):
        incident = self.create_incident(alert_rule=self.rule)
        IncidentTrigger.objects.create(
            incident=incident,
            alert_rule_trigger=self.trigger,
            status=TriggerStatus.ACTIVE.value,
        )

        with self.tasks(), self.capture_on_commit_callbacks(execute=True):
            update_alert_rule(self.rule, name="some rule updated")

        out = mail.outbox[0]
        assert out.to == [self.user.email]
        assert out.subject == f"[Resolved] {incident.title} - {self.project.slug}"

    def test_manual_resolve(self):
        incident = self.create_incident(alert_rule=self.rule)
        IncidentTrigger.objects.create(
            incident=incident,
            alert_rule_trigger=self.trigger,
            status=TriggerStatus.ACTIVE.value,
        )

        with self.tasks(), self.capture_on_commit_callbacks(execute=True):
            update_incident_status(
                incident=incident,
                status=IncidentStatus.CLOSED,
                status_method=IncidentStatusMethod.MANUAL,
            )

        assert len(mail.outbox) == 1
        out = mail.outbox[0]
        assert out.to == [self.user.email]
        assert out.subject == f"[Resolved] {incident.title} - {self.project.slug}"


class TestDeduplicateTriggerActions(TestCase):
    def setUp(self):
        super().setUp()
        self.alert_rule = self.create_alert_rule()
        self.incident = self.create_incident(alert_rule=self.alert_rule)
        self.integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )

    def run_test(self, input, output):
        key = lambda action: action.id
        assert sorted(deduplicate_trigger_actions(input), key=key) == sorted(output, key=key)

    def create_alert_rule_trigger_and_action(
        self,
        id,
        target_identifier,
        trigger_type=AlertRuleTriggerAction.Type.EMAIL.value,
        target_type=AlertRuleTriggerAction.TargetType.USER.value,
        warning=False,
        incident_trigger_status=TriggerStatus.ACTIVE.value,
    ):
        rule = self.create_alert_rule()
        alert_rule_trigger = self.create_alert_rule_trigger(
            alert_rule=rule,
            label=WARNING_TRIGGER_LABEL if warning else CRITICAL_TRIGGER_LABEL,
            alert_threshold=100,
        )
        action = AlertRuleTriggerAction.objects.create(
            id=id,
            alert_rule_trigger=alert_rule_trigger,
            type=trigger_type,
            integration_id=self.integration.id,
            target_type=target_type,
            target_identifier=target_identifier,
        )
        IncidentTrigger.objects.create(
            incident=self.incident,
            alert_rule_trigger=alert_rule_trigger,
            status=incident_trigger_status,
        )
        return alert_rule_trigger, action

    def test_critical_only(self):
        trigger_c, action_c = self.create_alert_rule_trigger_and_action(
            id=1, target_identifier="asdf", warning=False
        )
        AlertRuleTriggerAction.objects.create(
            id=2,
            alert_rule_trigger=trigger_c,
            type=AlertRuleTriggerAction.Type.EMAIL.value,
            integration_id=self.integration.id,
            target_type=AlertRuleTriggerAction.TargetType.USER.value,
            target_identifier="asdf",
        )
        self.run_test([trigger_c], [action_c])
        other_action_c = AlertRuleTriggerAction.objects.create(
            id=3,
            alert_rule_trigger=trigger_c,
            type=AlertRuleTriggerAction.Type.EMAIL.value,
            integration_id=self.integration.id,
            target_type=AlertRuleTriggerAction.TargetType.USER.value,
            target_identifier="not_asdf",
        )
        self.run_test([trigger_c], [action_c, other_action_c])

    def test_warning_only(self):
        trigger_w, action_w = self.create_alert_rule_trigger_and_action(
            id=1, target_identifier="asdf", warning=True
        )
        AlertRuleTriggerAction.objects.create(
            id=2,
            alert_rule_trigger=trigger_w,
            type=AlertRuleTriggerAction.Type.EMAIL.value,
            integration_id=self.integration.id,
            target_type=AlertRuleTriggerAction.TargetType.USER.value,
            target_identifier="asdf",
        )
        self.run_test([trigger_w], [action_w])
        other_action_w = AlertRuleTriggerAction.objects.create(
            id=3,
            alert_rule_trigger=trigger_w,
            type=AlertRuleTriggerAction.Type.EMAIL.value,
            integration_id=self.integration.id,
            target_type=AlertRuleTriggerAction.TargetType.USER.value,
            target_identifier="not_asdf",
        )
        self.run_test([trigger_w], [action_w, other_action_w])

    def test_critical_and_warning(self):
        trigger_w, action_w = self.create_alert_rule_trigger_and_action(
            id=2, target_identifier="asdf", warning=True
        )
        trigger_c, action_c = self.create_alert_rule_trigger_and_action(
            id=1, target_identifier="asdf", warning=False
        )
        # warning action should win over critical action
        self.run_test([trigger_w, trigger_c], [action_w])

        other_action_c = AlertRuleTriggerAction.objects.create(
            id=3,
            alert_rule_trigger=trigger_c,
            type=AlertRuleTriggerAction.Type.EMAIL.value,
            integration_id=self.integration.id,
            target_type=AlertRuleTriggerAction.TargetType.USER.value,
            target_identifier="not_asdf",
        )
        # this new critical should be preserved
        self.run_test([trigger_w, trigger_c], [action_w, other_action_c])

        other_action_w = AlertRuleTriggerAction.objects.create(
            id=4,
            alert_rule_trigger=trigger_w,
            type=AlertRuleTriggerAction.Type.EMAIL.value,
            integration_id=self.integration.id,
            target_type=AlertRuleTriggerAction.TargetType.USER.value,
            target_identifier="not_asdf",
        )
        # now this should win over the new critical
        self.run_test([trigger_w, trigger_c], [action_w, other_action_w])


class TestCustomMetricAlertRule(TestCase):
    @patch("sentry.incidents.logic.schedule_invalidate_project_config")
    def test_create_alert_rule(self, mocked_schedule_invalidate_project_config):
        self.create_alert_rule()

        mocked_schedule_invalidate_project_config.assert_not_called()

    @patch("sentry.incidents.logic.schedule_invalidate_project_config")
    def test_create_custom_metric_alert_rule_extraction(
        self, mocked_schedule_invalidate_project_config
    ):
        with self.feature({"organizations:on-demand-metrics-extraction": True}):
            self.create_alert_rule(
                projects=[self.project],
                dataset=Dataset.PerformanceMetrics,
                query="transaction.duration:>=100",
            )

            mocked_schedule_invalidate_project_config.assert_called_once_with(
                trigger="alerts:create-on-demand-metric", project_id=self.project.id
            )

    @patch("sentry.incidents.logic.schedule_invalidate_project_config")
    def test_create_custom_metric_alert_rule_prefill(
        self, mocked_schedule_invalidate_project_config
    ):
        with self.feature({"organizations:on-demand-metrics-prefill": True}):
            self.create_alert_rule(
                projects=[self.project],
                dataset=Dataset.PerformanceMetrics,
                query="transaction.duration:>=50",
            )

            mocked_schedule_invalidate_project_config.assert_called_once_with(
                trigger="alerts:create-on-demand-metric", project_id=self.project.id
            )

    @patch("sentry.incidents.logic.schedule_invalidate_project_config")
    def test_create_custom_metric_turned_off(self, mocked_schedule_invalidate_project_config):
        self.create_alert_rule(
            projects=[self.project],
            dataset=Dataset.PerformanceMetrics,
            query="transaction.duration:>=100",
        )

        mocked_schedule_invalidate_project_config.assert_not_called()


class TestGetAlertResolution(TestCase):
    def test_simple(self):
        time_window = 30
        result = get_alert_resolution(time_window, self.organization)
        assert result == DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION[time_window]

    def test_low_range(self):
        time_window = 2
        result = get_alert_resolution(time_window, self.organization)
        assert result == DEFAULT_ALERT_RULE_RESOLUTION

    def test_high_range(self):
        last_window = list(DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION.keys())[-1]
        time_window = last_window + 1000
        result = get_alert_resolution(time_window, self.organization)

        assert result == DEFAULT_ALERT_RULE_WINDOW_TO_RESOLUTION[last_window]

    def test_mid_range(self):
        time_window = 125
        result = get_alert_resolution(time_window, self.organization)

        # 125 is not part of the dict, will round down to the lower window of 120
        assert result == 3

    def test_crazy_low_range(self):
        time_window = -5
        result = get_alert_resolution(time_window, self.organization)
        assert result == DEFAULT_ALERT_RULE_RESOLUTION
