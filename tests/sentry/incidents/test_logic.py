from datetime import timedelta
from functools import cached_property
from unittest import mock
from unittest.mock import patch

import pytest
import responses
from django.core import mail
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.incidents.events import (
    IncidentCommentCreatedEvent,
    IncidentCreatedEvent,
    IncidentStatusUpdatedEvent,
)
from sentry.incidents.logic import (
    CRITICAL_TRIGGER_LABEL,
    DEFAULT_ALERT_RULE_RESOLUTION,
    DEFAULT_CMP_ALERT_RULE_RESOLUTION,
    WARNING_TRIGGER_LABEL,
    WINDOWED_STATS_DATA_POINTS,
    AlertRuleTriggerLabelAlreadyUsedError,
    ChannelLookupTimeoutError,
    InvalidTriggerActionError,
    ProjectsNotAssociatedWithAlertRuleError,
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
    get_available_action_integrations_for_org,
    get_excluded_projects_for_alert_rule,
    get_incident_aggregates,
    get_incident_subscribers,
    get_triggers_for_alert_rule,
    snapshot_alert_rule,
    subscribe_to_incident,
    translate_aggregate_field,
    update_alert_rule,
    update_alert_rule_trigger,
    update_alert_rule_trigger_action,
    update_incident_status,
)
from sentry.incidents.models import (
    AlertRule,
    AlertRuleStatus,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    AlertRuleTriggerExclusion,
    Incident,
    IncidentActivity,
    IncidentActivityType,
    IncidentProject,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentSubscription,
    IncidentTrigger,
    IncidentType,
    TriggerStatus,
)
from sentry.integrations.discord.utils.channel import ChannelType
from sentry.integrations.pagerduty.utils import add_service
from sentry.models.actor import ActorTuple, get_actor_for_user, get_actor_id_for_user
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.services.hybrid_cloud.integration.serial import serialize_integration
from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError, ApiTimeoutError
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.testutils.cases import BaseIncidentsTest, BaseMetricsTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import json

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
            type_=incident_type,
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

    def run_test(
        self, incident, status, expected_date_closed, user=None, comment=None, date_closed=None
    ):
        prev_status = incident.status
        self.record_event.reset_mock()
        update_incident_status(
            incident,
            status,
            user=user,
            comment=comment,
            status_method=IncidentStatusMethod.RULE_TRIGGERED,
            date_closed=date_closed,
        )
        incident = Incident.objects.get(id=incident.id)
        assert incident.status == status.value
        assert incident.date_closed == expected_date_closed
        activity = self.get_most_recent_incident_activity(incident)
        assert activity.type == IncidentActivityType.STATUS_CHANGE.value
        assert activity.user_id == (user.id if user else None)
        if user:
            assert IncidentSubscription.objects.filter(incident=incident, user_id=user.id).exists()
        assert activity.value == str(status.value)
        assert activity.previous_value == str(prev_status)
        assert activity.comment == comment

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
        self.run_test(
            incident, IncidentStatus.CLOSED, timezone.now(), user=self.user, comment="lol"
        )


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


class BaseIncidentAggregatesTest(BaseIncidentsTest):
    @property
    def project_incident(self):
        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5), query="", projects=[self.project]
        )
        self.create_event(self.now - timedelta(minutes=1))
        self.create_event(self.now - timedelta(minutes=2), user={"id": 123})
        self.create_event(self.now - timedelta(minutes=2), user={"id": 123})
        self.create_event(self.now - timedelta(minutes=2), user={"id": 124})
        return incident


class GetIncidentAggregatesTest(TestCase, BaseIncidentAggregatesTest):
    def test_projects(self):
        assert get_incident_aggregates(self.project_incident) == {"count": 4}


class GetCrashRateIncidentAggregatesTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.now = timezone.now().replace(minute=0, second=0, microsecond=0)
        for _ in range(2):
            self.store_session(self.build_session(status="exited"))
        self.dataset = Dataset.Sessions

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
        incident_aggregates = get_incident_aggregates(incident)
        assert "count" in incident_aggregates
        assert incident_aggregates["count"] == 100.0


class GetCrashRateMetricsIncidentAggregatesTest(
    GetCrashRateIncidentAggregatesTest, BaseMetricsTestCase
):
    def setUp(self):
        super().setUp()
        self.dataset = Dataset.Metrics


@freeze_time()
class CreateIncidentActivityTest(TestCase, BaseIncidentsTest):
    @pytest.fixture(autouse=True)
    def _setup_patches(self):
        with mock.patch(
            "sentry.incidents.tasks.send_subscriber_notifications"
        ) as self.send_subscriber_notifications:
            with mock.patch("sentry.analytics.base.Analytics.record_event") as self.record_event:
                yield

    def assert_notifications_sent(self, activity):
        self.send_subscriber_notifications.apply_async.assert_called_once_with(
            kwargs={"activity_id": activity.id}, countdown=10
        )

    def test_no_snapshot(self):
        incident = self.create_incident()
        self.record_event.reset_mock()
        activity = create_incident_activity(
            incident,
            IncidentActivityType.STATUS_CHANGE,
            user=self.user,
            value=str(IncidentStatus.CLOSED.value),
            previous_value=str(IncidentStatus.WARNING.value),
        )
        assert activity.incident == incident
        assert activity.type == IncidentActivityType.STATUS_CHANGE.value
        assert activity.user_id == self.user.id
        assert activity.value == str(IncidentStatus.CLOSED.value)
        assert activity.previous_value == str(IncidentStatus.WARNING.value)
        self.assert_notifications_sent(activity)
        assert not self.record_event.called

    def test_comment(self):
        incident = self.create_incident()
        comment = "hello"

        assert not IncidentSubscription.objects.filter(
            incident=incident, user_id=self.user.id
        ).exists()
        self.record_event.reset_mock()
        activity = create_incident_activity(
            incident, IncidentActivityType.COMMENT, user=self.user, comment=comment
        )
        assert IncidentSubscription.objects.filter(incident=incident, user_id=self.user.id).exists()

        assert activity.incident == incident
        assert activity.type == IncidentActivityType.COMMENT.value
        assert activity.user_id == self.user.id
        assert activity.comment == comment
        assert activity.value is None
        assert activity.previous_value is None
        self.assert_notifications_sent(activity)
        assert len(self.record_event.call_args_list) == 1
        event = self.record_event.call_args[0][0]
        assert isinstance(event, IncidentCommentCreatedEvent)
        assert event.data == {
            "organization_id": str(self.organization.id),
            "incident_id": str(incident.id),
            "incident_type": str(incident.type),
            "user_id": str(self.user.id),
            "activity_id": str(activity.id),
        }

    def test_mentioned_user_ids(self):
        incident = self.create_incident()
        mentioned_member = self.create_user()
        subscribed_mentioned_member = self.create_user()
        IncidentSubscription.objects.create(
            incident=incident, user_id=subscribed_mentioned_member.id
        )
        comment = f"hello **@{mentioned_member.username}** and **@{subscribed_mentioned_member.username}**"

        assert not IncidentSubscription.objects.filter(
            incident=incident, user_id=mentioned_member.id
        ).exists()
        self.record_event.reset_mock()
        activity = create_incident_activity(
            incident,
            IncidentActivityType.COMMENT,
            user=self.user,
            comment=comment,
            mentioned_user_ids=[mentioned_member.id, subscribed_mentioned_member.id],
        )
        assert IncidentSubscription.objects.filter(
            incident=incident, user_id=mentioned_member.id
        ).exists()

        assert activity.incident == incident
        assert activity.type == IncidentActivityType.COMMENT.value
        assert activity.user_id == self.user.id
        assert activity.comment == comment
        assert activity.value is None
        assert activity.previous_value is None
        self.assert_notifications_sent(activity)
        assert len(self.record_event.call_args_list) == 1
        event = self.record_event.call_args[0][0]
        assert isinstance(event, IncidentCommentCreatedEvent)
        assert event.data == {
            "organization_id": str(self.organization.id),
            "incident_id": str(incident.id),
            "incident_type": str(incident.type),
            "user_id": str(self.user.id),
            "activity_id": str(activity.id),
        }


class GetIncidentSubscribersTest(TestCase, BaseIncidentsTest):
    def test_simple(self):
        incident = self.create_incident()
        assert list(get_incident_subscribers(incident)) == []
        subscription = subscribe_to_incident(incident, self.user.id)[0]
        assert list(get_incident_subscribers(incident)) == [subscription]


class CreateAlertRuleTest(TestCase, BaseIncidentsTest):
    def test(self):
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
        assert alert_rule.snuba_query.subscriptions.get().project == self.project
        assert alert_rule.name == name
        assert alert_rule.owner is None
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

    def test_ignore(self):
        name = "hello"
        query = "status:unresolved"
        aggregate = "count(*)"
        time_window = 10
        threshold_type = AlertRuleThresholdType.ABOVE
        resolve_threshold = 10
        threshold_period = 1
        event_types = [SnubaQueryEventType.EventType.ERROR]
        with self.feature("organizations:metric-alert-ignore-archived"):
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
        assert alert_rule.owner is None
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
        assert alert_rule.owner is None
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

    def test_include_all_projects(self):
        include_all_projects = True
        self.project
        alert_rule = self.create_alert_rule(projects=[], include_all_projects=include_all_projects)
        assert alert_rule.snuba_query.subscriptions.get().project == self.project
        assert alert_rule.include_all_projects == include_all_projects

        new_project = self.create_project(fire_project_created=True)
        alert_rule = self.create_alert_rule(
            projects=[], include_all_projects=include_all_projects, excluded_projects=[self.project]
        )
        assert alert_rule.snuba_query.subscriptions.get().project == new_project
        assert alert_rule.include_all_projects == include_all_projects

    # This test will fail unless real migrations are run. Refer to migration 0061.
    @pytest.mark.migrations  # requires custom migration 0061
    def test_two_archived_with_same_name(self):
        name = "allowed"
        alert_rule_1 = create_alert_rule(
            self.organization,
            [self.project],
            name,
            "level:error",
            "count()",
            1,
            AlertRuleThresholdType.ABOVE,
            1,
        )
        alert_rule_1.update(status=AlertRuleStatus.SNAPSHOT.value)

        alert_rule_2 = create_alert_rule(
            self.organization,
            [self.project],
            name,
            "level:error",
            "count()",
            1,
            AlertRuleThresholdType.ABOVE,
            1,
        )
        alert_rule_2.update(status=AlertRuleStatus.SNAPSHOT.value)

        assert alert_rule_1.name == alert_rule_2.name
        assert alert_rule_1.status == AlertRuleStatus.SNAPSHOT.value
        assert alert_rule_2.status == AlertRuleStatus.SNAPSHOT.value

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
            owner=ActorTuple.from_actor_identifier(self.user.id),
        )
        assert alert_rule_1.owner.id == get_actor_id_for_user(self.user)
        alert_rule_2 = create_alert_rule(
            self.organization,
            [self.project],
            "alert rule 2",
            "level:error",
            "count()",
            1,
            AlertRuleThresholdType.ABOVE,
            1,
            owner=ActorTuple.from_actor_identifier(f"team:{self.team.id}"),
        )
        assert alert_rule_2.owner.id == self.team.actor.id

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
        )
        assert alert_rule.snuba_query.subscriptions.get().project == self.project
        assert alert_rule.comparison_delta == comparison_delta * 60
        assert alert_rule.snuba_query.resolution == DEFAULT_CMP_ALERT_RULE_RESOLUTION * 60

    def test_session_to_metric_alert(self):
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "session alert rule",
            "",
            "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            1,
            AlertRuleThresholdType.ABOVE,
            1,
            query_type=SnubaQuery.Type.CRASH_RATE,
            dataset=Dataset.Sessions,
        )
        assert alert_rule.snuba_query.type == SnubaQuery.Type.CRASH_RATE.value
        assert alert_rule.snuba_query.dataset == Dataset.Sessions.value

        with self.feature("organizations:alert-crash-free-metrics"):
            alert_rule = create_alert_rule(
                self.organization,
                [self.project],
                "session converted alert rule",
                "",
                "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
                1,
                AlertRuleThresholdType.ABOVE,
                1,
                query_type=SnubaQuery.Type.CRASH_RATE,
                dataset=Dataset.Sessions,
            )
        assert alert_rule.snuba_query.type == SnubaQuery.Type.CRASH_RATE.value
        assert alert_rule.snuba_query.dataset == Dataset.Metrics.value

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


class UpdateAlertRuleTest(TestCase, BaseIncidentsTest):
    @cached_property
    def alert_rule(self):
        return self.create_alert_rule(name="hello")

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

    def test_update_subscription(self):
        old_subscription_id = self.alert_rule.snuba_query.subscriptions.get().subscription_id
        with self.tasks():
            update_alert_rule(self.alert_rule, query="some new query")
        assert (
            old_subscription_id != self.alert_rule.snuba_query.subscriptions.get().subscription_id
        )

    def test_snapshot_alert_rule_with_only_owner(self):
        # Force the alert rule into an invalid state
        AlertRule.objects.filter(id=self.alert_rule.id).update(
            user_id=None, team_id=None, owner=get_actor_for_user(self.user)
        )
        self.alert_rule.refresh_from_db()
        snapshot_alert_rule(self.alert_rule, self.user)

    def test_empty_query(self):
        alert_rule = update_alert_rule(self.alert_rule, query="")
        assert alert_rule.snuba_query.query == ""

    def test_delete_projects(self):
        alert_rule = self.create_alert_rule(
            projects=[self.project, self.create_project(fire_project_created=True)]
        )
        update_alert_rule(alert_rule, projects=[self.project])
        assert self.alert_rule.snuba_query.subscriptions.get().project == self.project

    def test_new_updated_deleted_projects(self):
        alert_rule = self.create_alert_rule(
            projects=[self.project, self.create_project(fire_project_created=True)]
        )
        query_update = "level:warning"
        new_project = self.create_project(fire_project_created=True)
        updated_projects = [self.project, new_project]
        with self.tasks():
            update_alert_rule(alert_rule, projects=updated_projects, query=query_update)
        updated_subscriptions = alert_rule.snuba_query.subscriptions.all()
        assert {sub.project for sub in updated_subscriptions} == set(updated_projects)
        for sub in updated_subscriptions:
            assert sub.snuba_query.query == query_update

    def test_update_to_include_all(self):
        orig_project = self.project
        alert_rule = self.create_alert_rule(projects=[orig_project])
        new_project = self.create_project(fire_project_created=True)
        assert not alert_rule.snuba_query.subscriptions.filter(project=new_project).exists()
        update_alert_rule(alert_rule, include_all_projects=True)
        assert {sub.project for sub in alert_rule.snuba_query.subscriptions.all()} == {
            new_project,
            orig_project,
        }

    def test_update_to_include_all_with_exclude(self):
        orig_project = self.project
        alert_rule = self.create_alert_rule(projects=[orig_project])
        new_project = self.create_project(fire_project_created=True)
        excluded_project = self.create_project()
        assert not alert_rule.snuba_query.subscriptions.filter(project=new_project).exists()
        update_alert_rule(
            alert_rule, include_all_projects=True, excluded_projects=[excluded_project]
        )
        assert {sub.project for sub in alert_rule.snuba_query.subscriptions.all()} == {
            orig_project,
            new_project,
        }

    def test_update_include_all_exclude_list(self):
        new_project = self.create_project(fire_project_created=True)
        projects = {new_project, self.project}
        alert_rule = self.create_alert_rule(include_all_projects=True)
        assert {sub.project for sub in alert_rule.snuba_query.subscriptions.all()} == projects
        with self.tasks():
            update_alert_rule(alert_rule, excluded_projects=[self.project])
        assert [sub.project for sub in alert_rule.snuba_query.subscriptions.all()] == [new_project]

        update_alert_rule(alert_rule, excluded_projects=[])
        assert {sub.project for sub in alert_rule.snuba_query.subscriptions.all()} == projects

    def test_update_from_include_all(self):
        new_project = self.create_project(fire_project_created=True)
        projects = {new_project, self.project}
        alert_rule = self.create_alert_rule(include_all_projects=True)
        assert {sub.project for sub in alert_rule.snuba_query.subscriptions.all()} == projects
        with self.tasks():
            update_alert_rule(alert_rule, projects=[new_project], include_all_projects=False)
        assert [sub.project for sub in alert_rule.snuba_query.subscriptions.all()] == [new_project]

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
            rule_snapshot = AlertRule.objects_with_snapshots.filter(
                name=self.alert_rule.name
            ).exclude(id=updated_rule.id)
            assert rule_snapshot.count() == 1
            rule_snapshot = rule_snapshot.first()
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
            owner=ActorTuple.from_actor_identifier(self.user.id),
        )
        assert alert_rule.owner.id == get_actor_id_for_user(self.user)
        update_alert_rule(
            alert_rule=alert_rule,
            owner=ActorTuple.from_actor_identifier(f"team:{self.team.id}"),
        )
        assert alert_rule.owner.id == self.team.actor.id
        update_alert_rule(
            alert_rule=alert_rule,
            owner=ActorTuple.from_actor_identifier(f"user:{self.user.id}"),
        )
        assert alert_rule.owner.id == get_actor_id_for_user(self.user)
        update_alert_rule(
            alert_rule=alert_rule,
            owner=ActorTuple.from_actor_identifier(self.user.id),
        )
        assert alert_rule.owner.id == get_actor_id_for_user(self.user)
        update_alert_rule(
            alert_rule=alert_rule,
            name="not updating owner",
        )
        assert alert_rule.owner.id == get_actor_id_for_user(self.user)

        update_alert_rule(
            alert_rule=alert_rule,
            owner=None,
        )
        assert alert_rule.owner is None

    def test_comparison_delta(self):
        comparison_delta = 60

        update_alert_rule(self.alert_rule, comparison_delta=comparison_delta)
        assert self.alert_rule.comparison_delta == comparison_delta * 60
        assert self.alert_rule.snuba_query.resolution == DEFAULT_CMP_ALERT_RULE_RESOLUTION * 60

        # Should be no change if we don't specify `comparison_delta` for update at all.
        update_alert_rule(self.alert_rule)
        assert self.alert_rule.comparison_delta == comparison_delta * 60
        assert self.alert_rule.snuba_query.resolution == DEFAULT_CMP_ALERT_RULE_RESOLUTION * 60

        # Should change if we explicitly set it to None.
        update_alert_rule(self.alert_rule, comparison_delta=None)
        assert self.alert_rule.comparison_delta is None
        assert self.alert_rule.snuba_query.resolution == DEFAULT_ALERT_RULE_RESOLUTION * 60

    def test_session_to_metric_alert(self):
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "session alert rule",
            "",
            "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            1,
            AlertRuleThresholdType.ABOVE,
            1,
            query_type=SnubaQuery.Type.CRASH_RATE,
            dataset=Dataset.Sessions,
        )
        alert_rule = update_alert_rule(alert_rule, dataset=Dataset.Sessions)
        assert alert_rule.snuba_query.type == SnubaQuery.Type.CRASH_RATE.value
        assert alert_rule.snuba_query.dataset == Dataset.Sessions.value

        with self.feature("organizations:alert-crash-free-metrics"):
            alert_rule = update_alert_rule(alert_rule, dataset=Dataset.Sessions)
        assert alert_rule.snuba_query.type == SnubaQuery.Type.CRASH_RATE.value
        assert alert_rule.snuba_query.dataset == Dataset.Metrics.value

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


class DeleteAlertRuleTest(TestCase, BaseIncidentsTest):
    @cached_property
    def alert_rule(self):
        return self.create_alert_rule()

    def test(self):
        alert_rule_id = self.alert_rule.id
        with self.tasks():
            delete_alert_rule(self.alert_rule)

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

    @patch("sentry.incidents.logic.schedule_update_project_config")
    def test_on_demand_metric_alert(self, mocked_schedule_update_project_config):
        alert_rule = self.create_alert_rule(query="transaction.duration:>=100")

        with self.tasks():
            delete_alert_rule(alert_rule)

        mocked_schedule_update_project_config.assert_called_with(alert_rule, [self.project])


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


class DisbaleAlertRuleTest(TestCase, BaseIncidentsTest):
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


class TestGetExcludedProjectsForAlertRule(TestCase):
    def test(self):
        excluded = [self.create_project(fire_project_created=True)]
        alert_rule = self.create_alert_rule(
            projects=[], include_all_projects=True, excluded_projects=excluded
        )
        exclusions = get_excluded_projects_for_alert_rule(alert_rule)
        assert [exclusion.project for exclusion in exclusions] == excluded

    def test_no_excluded(self):
        self.create_project(fire_project_created=True)
        alert_rule = self.create_alert_rule(projects=[], include_all_projects=True)
        assert list(get_excluded_projects_for_alert_rule(alert_rule)) == []


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
        assert not AlertRuleTriggerExclusion.objects.filter(alert_rule_trigger=trigger).exists()

    def test_excluded_projects(self):
        excluded_project = self.create_project(fire_project_created=True)
        alert_rule = self.create_alert_rule(projects=[self.project, excluded_project])
        trigger = create_alert_rule_trigger(
            alert_rule, "hi", 100, excluded_projects=[excluded_project]
        )
        # We should have only one exclusion
        exclusion = AlertRuleTriggerExclusion.objects.get(alert_rule_trigger=trigger)
        assert exclusion.query_subscription.project == excluded_project

    def test_excluded_projects_not_associated_with_rule(self):
        other_project = self.create_project(fire_project_created=True)
        alert_rule = self.create_alert_rule(projects=[self.project])
        with pytest.raises(ProjectsNotAssociatedWithAlertRuleError):
            create_alert_rule_trigger(alert_rule, "hi", 100, excluded_projects=[other_project])

    def test_existing_label(self):
        name = "uh oh"
        create_alert_rule_trigger(self.alert_rule, name, 100)
        with pytest.raises(AlertRuleTriggerLabelAlreadyUsedError):
            create_alert_rule_trigger(self.alert_rule, name, 100)


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

    def test_name_used(self):
        label = "uh oh"
        create_alert_rule_trigger(self.alert_rule, label, 1000)
        trigger = create_alert_rule_trigger(self.alert_rule, "something else", 1000)
        with pytest.raises(AlertRuleTriggerLabelAlreadyUsedError):
            update_alert_rule_trigger(trigger, label=label)

    def test_exclude_projects(self):
        other_project = self.create_project(fire_project_created=True)

        alert_rule = self.create_alert_rule(projects=[other_project, self.project])
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)
        update_alert_rule_trigger(trigger, excluded_projects=[other_project])
        assert trigger.exclusions.get().query_subscription.project == other_project

    def test_complex_exclude_projects(self):
        excluded_project = self.create_project()
        other_project = self.create_project(fire_project_created=True)

        alert_rule = self.create_alert_rule(
            projects=[excluded_project, self.project, other_project]
        )
        trigger = create_alert_rule_trigger(
            alert_rule, "hi", 1000, excluded_projects=[excluded_project, self.project]
        )
        update_alert_rule_trigger(trigger, excluded_projects=[other_project, excluded_project])
        excluded_projects = [
            exclusion.query_subscription.project for exclusion in trigger.exclusions.all()
        ]
        assert set(excluded_projects) == {other_project, excluded_project}

    def test_excluded_projects_not_associated_with_rule(self):
        other_project = self.create_project(fire_project_created=True)
        alert_rule = self.create_alert_rule(projects=[self.project])
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)

        with pytest.raises(ProjectsNotAssociatedWithAlertRuleError):
            update_alert_rule_trigger(trigger, excluded_projects=[other_project])


class DeleteAlertRuleTriggerTest(TestCase):
    def test(self):
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(
            alert_rule, "hi", 1000, excluded_projects=[self.project]
        )
        trigger_id = trigger.id
        assert AlertRuleTriggerExclusion.objects.filter(
            alert_rule_trigger=trigger, query_subscription__project=self.project
        ).exists()
        delete_alert_rule_trigger(trigger)

        assert not AlertRuleTrigger.objects.filter(id=trigger_id).exists()
        assert not AlertRuleTriggerExclusion.objects.filter(
            alert_rule_trigger=trigger, query_subscription__project=self.project
        ).exists()


class GetTriggersForAlertRuleTest(TestCase):
    def test(self):
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)
        assert get_triggers_for_alert_rule(alert_rule).get() == trigger


class BaseAlertRuleTriggerActionTest:
    @cached_property
    def alert_rule(self):
        return self.create_alert_rule()

    @cached_property
    def trigger(self):
        return create_alert_rule_trigger(self.alert_rule, "hello", 1000)


class CreateAlertRuleTriggerActionTest(BaseAlertRuleTriggerActionTest, TestCase):
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
                target_identifier=1,
            )

    @responses.activate
    def test_slack(self):
        integration = Integration.objects.create(
            external_id="2",
            provider="slack",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.SLACK
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "#some_channel"
        channel_id = "s_c"
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.scheduleMessage",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channel": channel_id, "scheduled_message_id": "Q1298393284"}
            ),
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.deleteScheduledMessage",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": True}),
        )

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
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.SLACK
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "#some_channel_that_doesnt_exist"
        with pytest.raises(ApiError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=channel_name,
                integration_id=integration.id,
            )

    @responses.activate
    def test_slack_rate_limiting(self):
        """Should handle 429 from Slack on new Metric Alert creation"""
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.SLACK
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "#some_channel"

        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.scheduleMessage",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": False, "error": "channel_not_found"}),
        )

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/users.list",
            status=429,
            content_type="application/json",
            body=json.dumps({"ok": False, "error": "ratelimited"}),
        )
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
        integration = Integration.objects.create(external_id="1", provider="msteams")
        integration.add_organization(self.organization, self.user)
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
        integration = Integration.objects.create(external_id="1", provider="msteams")
        integration.add_organization(self.organization, self.user)
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
        integration = Integration.objects.create(
            provider="pagerduty",
            name="Example PagerDuty",
            external_id="example-pagerduty",
            metadata={"services": services},
        )
        org_integration = integration.add_organization(self.organization, self.user)
        service = add_service(
            org_integration,
            service_name=services[0]["service_name"],
            integration_key=services[0]["integration_key"],
        )
        type = AlertRuleTriggerAction.Type.PAGERDUTY
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        target_identifier = service["id"]
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
        assert action.target_identifier == target_identifier
        assert action.target_display == "hellboi"
        assert action.integration_id == integration.id

    def test_pagerduty_not_existing(self):
        integration = Integration.objects.create(
            provider="pagerduty",
            name="Example PagerDuty",
            external_id="example-pagerduty",
        )
        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.PAGERDUTY
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        target_identifier = 1

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
        integration = Integration.objects.create(
            provider="discord",
            name="Example Discord",
            external_id=guild_id,
            metadata=metadata,
        )
        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_id = "channel-id"
        responses.add(
            method=responses.GET,
            url=f"https://discord.com/api/v10/channels/{channel_id}",
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
        integration = Integration.objects.create(
            provider="discord",
            external_id=guild_id,
            metadata=metadata,
        )

        integration.add_organization(self.organization, self.user)
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


class UpdateAlertRuleTriggerAction(BaseAlertRuleTriggerActionTest, TestCase):
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

    @responses.activate
    def test_slack(self):
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.SLACK
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "#some_channel"
        channel_id = "s_c"
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.scheduleMessage",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channel": channel_id, "scheduled_message_id": "Q1298393284"}
            ),
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.deleteScheduledMessage",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": True}),
        )

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
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.SLACK
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "#some_channel_that_doesnt_exist"
        with pytest.raises(ApiError):
            update_alert_rule_trigger_action(
                self.action,
                type,
                target_type,
                target_identifier=channel_name,
                integration_id=integration.id,
            )

    @responses.activate
    def test_slack_rate_limiting(self):
        """Should handle 429 from Slack on existing Metric Alert update"""
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.SLACK
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "#some_channel"

        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.scheduleMessage",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": False, "error": "channel_not_found"}),
        )

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/users.list",
            status=429,
            content_type="application/json",
            body=json.dumps({"ok": False, "error": "ratelimited"}),
        )
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
        integration = Integration.objects.create(external_id="1", provider="msteams")
        integration.add_organization(self.organization, self.user)
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
        integration = Integration.objects.create(external_id="1", provider="msteams")
        integration.add_organization(self.organization, self.user)
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
        integration = Integration.objects.create(
            provider="pagerduty",
            name="Example PagerDuty",
            external_id="example-pagerduty",
            metadata={"services": services},
        )
        org_integration = integration.add_organization(self.organization, self.user)
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
            target_identifier=target_identifier,
            integration_id=integration.id,
        )

        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == target_identifier
        assert action.target_display == "hellboi"
        assert action.integration_id == integration.id

    def test_pagerduty_not_existing(self):
        integration = Integration.objects.create(
            provider="pagerduty",
            name="Example PagerDuty",
            external_id="example-pagerduty",
        )
        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.PAGERDUTY
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        target_identifier = 1

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
            "base_url": "https://api.opsgenie.com/",
            "domain_name": "test-app.app.opsgenie.com",
        }
        team = {"id": "123-id", "team": "cool-team", "integration_key": "1234-5678"}
        integration = Integration.objects.create(
            provider="opsgenie", name="test-app", external_id="test-app", metadata=metadata
        )
        integration.add_organization(self.organization, self.user)
        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )
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
            "base_url": "https://api.opsgenie.com/",
            "domain_name": "test-app.app.opsgenie.com",
        }
        integration = Integration.objects.create(
            provider="opsgenie", name="test-app", external_id="test-app", metadata=metadata
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
        base_url: str = "https://discord.com/api/v10"
        channel_id = "channel-id"
        guild_id = "example-discord-server"
        guild_name = "Server Name"

        integration = Integration.objects.create(
            provider="discord",
            name="Example Discord",
            external_id=f"{guild_id}",
            metadata={
                "guild_id": f"{guild_id}",
                "name": f"{guild_name}",
                "type": ChannelType.GUILD_TEXT.value,
            },
        )

        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        responses.add(
            method=responses.GET,
            url=f"{base_url}/channels/{channel_id}",
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
        base_url: str = "https://discord.com/api/v10"
        channel_id = "****bad****"
        guild_id = "example-discord-server"
        guild_name = "Server Name"

        integration = Integration.objects.create(
            provider="discord",
            name="Example Discord",
            external_id=f"{guild_id}",
            metadata={
                "guild_id": f"{guild_id}",
                "name": f"{guild_name}",
                "type": ChannelType.GUILD_TEXT.value,
            },
        )

        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        responses.add(method=responses.GET, url=f"{base_url}/channels/{channel_id}", status=404)

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
        base_url: str = "https://discord.com/api/v10"
        channel_id = "channel-id"
        guild_id = "example-discord-server"
        guild_name = "Server Name"

        integration = Integration.objects.create(
            provider="discord",
            name="Example Discord",
            external_id=f"{guild_id}",
            metadata={
                "guild_id": f"{guild_id}",
                "name": f"{guild_name}",
                "type": ChannelType.GUILD_TEXT.value,
            },
        )

        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        responses.add(
            method=responses.GET, url=f"{base_url}/channels/{channel_id}", body="Error", status=500
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

        base_url: str = "https://discord.com/api/v10"
        channel_id = "channel-id"
        guild_id = "example-discord-server"
        guild_name = "Server Name"

        integration = Integration.objects.create(
            provider="discord",
            name="Example Discord",
            external_id=f"{guild_id}",
            metadata={
                "guild_id": f"{guild_id}",
                "name": f"{guild_name}",
                "type": ChannelType.GUILD_TEXT.value,
            },
        )

        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        responses.add(
            method=responses.GET,
            url=f"{base_url}/channels/{channel_id}",
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
        base_url: str = "https://discord.com/api/v10"
        channel_id = "channel-id"
        guild_id = "example-discord-server"
        guild_name = "Server Name"

        integration = Integration.objects.create(
            provider="discord",
            name="Example Discord",
            external_id=f"{guild_id}",
            metadata={
                "guild_id": f"{guild_id}",
                "name": f"{guild_name}",
                "type": ChannelType.DM.value,
            },
        )

        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        responses.add(
            method=responses.GET,
            url=f"{base_url}/channels/{channel_id}",
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
        base_url: str = "https://discord.com/api/v10"
        channel_id = "channel-id"
        guild_id = "example-discord-server"
        guild_name = "Server Name"

        integration = Integration.objects.create(
            provider="discord",
            name="Example Discord",
            external_id=f"{guild_id}",
            metadata={
                "guild_id": f"{guild_id}",
                "name": f"{guild_name}",
                "type": ChannelType.DM.value,
            },
        )

        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.DISCORD
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        responses.add(
            method=responses.GET,
            url=f"{base_url}/channels/{channel_id}",
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


class DeleteAlertRuleTriggerAction(BaseAlertRuleTriggerActionTest, TestCase):
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


class GetActionsForTriggerTest(BaseAlertRuleTriggerActionTest, TestCase):
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
        integration = Integration.objects.create(external_id="1", provider="something_random")
        integration.add_organization(self.organization)
        assert list(get_available_action_integrations_for_org(self.organization)) == []

    def test_registered(self):
        integration = Integration.objects.create(external_id="1", provider="slack")
        integration.add_organization(self.organization)
        assert list(get_available_action_integrations_for_org(self.organization)) == [
            serialize_integration(integration)
        ]

    def test_mixed(self):
        integration = Integration.objects.create(external_id="1", provider="slack")
        integration.add_organization(self.organization)
        other_integration = Integration.objects.create(external_id="12345", provider="random")
        other_integration.add_organization(self.organization)
        assert list(get_available_action_integrations_for_org(self.organization)) == [
            serialize_integration(integration)
        ]

    def test_disabled_integration(self):
        integration = Integration.objects.create(
            external_id="1", provider="slack", status=ObjectStatus.DISABLED
        )
        integration.add_organization(self.organization)
        assert list(get_available_action_integrations_for_org(self.organization)) == []

    def test_disabled_org_integration(self):
        integration = Integration.objects.create(external_id="1", provider="slack")
        org_integration = integration.add_organization(self.organization)
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
        self.integration = Integration.objects.create(
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
    def test_create_custom_metric_alert_rule(self, mocked_schedule_invalidate_project_config):
        with self.feature({"organizations:on-demand-metrics-extraction": True}):
            self.create_alert_rule(
                projects=[self.project],
                dataset=Dataset.PerformanceMetrics,
                query="transaction.duration:>=100",
            )

            mocked_schedule_invalidate_project_config.assert_called_once_with(
                trigger="alerts:create-on-demand-metric", project_id=self.project.id
            )

        mocked_schedule_invalidate_project_config.reset_mock()

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
