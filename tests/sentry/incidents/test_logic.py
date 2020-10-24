from __future__ import absolute_import

import pytest
import pytz
import responses
from datetime import datetime, timedelta
from exam import fixture, patcher
from freezegun import freeze_time

import six
from django.conf import settings
from django.core import mail
from django.utils import timezone

from sentry.api.event_search import InvalidSearchQuery
from sentry.incidents.events import (
    IncidentCommentCreatedEvent,
    IncidentCreatedEvent,
    IncidentStatusUpdatedEvent,
)
from sentry.incidents.logic import (
    AlertRuleNameAlreadyUsedError,
    AlertRuleTriggerLabelAlreadyUsedError,
    InvalidTriggerActionError,
    calculate_incident_time_range,
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    create_event_stat_snapshot,
    create_incident,
    create_incident_activity,
    create_incident_snapshot,
    CRITICAL_TRIGGER_LABEL,
    deduplicate_trigger_actions,
    delete_alert_rule,
    delete_alert_rule_trigger,
    delete_alert_rule_trigger_action,
    disable_alert_rule,
    DEFAULT_ALERT_RULE_RESOLUTION,
    enable_alert_rule,
    get_actions_for_trigger,
    get_available_action_integrations_for_org,
    get_excluded_projects_for_alert_rule,
    get_incident_aggregates,
    get_incident_event_stats,
    get_incident_stats,
    get_incident_subscribers,
    get_triggers_for_alert_rule,
    ProjectsNotAssociatedWithAlertRuleError,
    subscribe_to_incident,
    translate_aggregate_field,
    update_alert_rule,
    update_alert_rule_trigger_action,
    update_alert_rule_trigger,
    update_incident_status,
    WARNING_TRIGGER_LABEL,
    WINDOWED_STATS_DATA_POINTS,
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
    PendingIncidentSnapshot,
    IncidentSnapshot,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentSubscription,
    IncidentTrigger,
    IncidentType,
    TimeSeriesSnapshot,
    TriggerStatus,
)
from sentry.snuba.models import QueryDatasets, QuerySubscription, SnubaQueryEventType
from sentry.models.integration import Integration
from sentry.testutils import TestCase, BaseIncidentsTest
from sentry.models import PagerDutyService

from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils import json
from sentry.utils.compat.mock import patch
from sentry.utils.samples import load_data


class CreateIncidentTest(TestCase):
    record_event = patcher("sentry.analytics.base.Analytics.record_event")

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
                date_added=date_detected,
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
            "organization_id": six.text_type(self.organization.id),
            "incident_id": six.text_type(incident.id),
            "incident_type": six.text_type(IncidentType.ALERT_TRIGGERED.value),
        }


@freeze_time()
class UpdateIncidentStatus(TestCase):
    record_event = patcher("sentry.analytics.base.Analytics.record_event")

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
        assert activity.user == user
        if user:
            assert IncidentSubscription.objects.filter(incident=incident, user=user).exists()
        assert activity.value == six.text_type(status.value)
        assert activity.previous_value == six.text_type(prev_status)
        assert activity.comment == comment

        assert len(self.record_event.call_args_list) == 1
        event = self.record_event.call_args[0][0]
        assert isinstance(event, IncidentStatusUpdatedEvent)
        assert event.data == {
            "organization_id": six.text_type(self.organization.id),
            "incident_id": six.text_type(incident.id),
            "incident_type": six.text_type(incident.type),
            "prev_status": six.text_type(prev_status),
            "status": six.text_type(incident.status),
        }

    def test_closed(self):
        incident = self.create_incident(
            self.organization, title="Test", date_started=timezone.now(), projects=[self.project]
        )
        with self.assertChanges(
            lambda: PendingIncidentSnapshot.objects.filter(incident=incident).exists(),
            before=False,
            after=True,
        ):
            self.run_test(incident, IncidentStatus.CLOSED, timezone.now())

    def test_closed_specify_date(self):
        incident = self.create_incident(
            self.organization,
            title="Test",
            date_started=timezone.now() - timedelta(days=5),
            projects=[self.project],
        )
        with self.assertChanges(
            lambda: PendingIncidentSnapshot.objects.filter(incident=incident).exists(),
            before=False,
            after=True,
        ):
            date_closed = timezone.now() - timedelta(days=1)
            self.run_test(incident, IncidentStatus.CLOSED, date_closed, date_closed=date_closed)

    def test_pending_snapshot_management(self):
        # Test to verify PendingIncidentSnapshot's are created on close, and deleted on open
        incident = self.create_incident(
            self.organization, title="Test", date_started=timezone.now(), projects=[self.project]
        )
        assert PendingIncidentSnapshot.objects.all().count() == 0
        update_incident_status(incident, IncidentStatus.CLOSED)
        assert PendingIncidentSnapshot.objects.filter(incident=incident).count() == 1
        update_incident_status(incident, IncidentStatus.OPEN)
        assert PendingIncidentSnapshot.objects.filter(incident=incident).count() == 0

    def test_all_params(self):
        incident = self.create_incident()
        self.run_test(
            incident, IncidentStatus.CLOSED, timezone.now(), user=self.user, comment="lol"
        )


class BaseIncidentEventStatsTest(BaseIncidentsTest):
    @fixture
    def project_incident(self):
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=1))
        return self.create_incident(
            date_started=self.now - timedelta(minutes=5), query="", projects=[self.project]
        )

    @fixture
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


@freeze_time()
class GetIncidentEventStatsTest(TestCase, BaseIncidentEventStatsTest):
    @fixture
    def bucket_incident(self):
        incident_start = self.now - timedelta(minutes=23)
        self.create_event(incident_start + timedelta(seconds=1))
        self.create_event(incident_start + timedelta(minutes=2))
        self.create_event(incident_start + timedelta(minutes=6))
        self.create_event(incident_start + timedelta(minutes=9, seconds=59))
        self.create_event(incident_start + timedelta(minutes=14))
        self.create_event(incident_start + timedelta(minutes=16))
        alert_rule = self.create_alert_rule(time_window=10)
        return self.create_incident(date_started=incident_start, query="", alert_rule=alert_rule)

    def run_test(self, incident, expected_results, start=None, end=None, windowed_stats=False):
        kwargs = {}
        if start is not None:
            kwargs["start"] = start
        if end is not None:
            kwargs["end"] = end

        result = get_incident_event_stats(incident, windowed_stats=windowed_stats, **kwargs)
        self.validate_result(incident, result, expected_results, start, end, windowed_stats)

    def test_project(self):
        self.run_test(self.project_incident, [2, 1])
        self.run_test(self.project_incident, [1], start=self.now - timedelta(minutes=1))
        self.run_test(self.project_incident, [2], end=self.now - timedelta(minutes=1, seconds=59))

        self.run_test(self.project_incident, [2, 1], windowed_stats=True)
        self.run_test(
            self.project_incident,
            [2, 1],
            start=self.now - timedelta(minutes=1),
            windowed_stats=True,
        )
        self.run_test(
            self.project_incident,
            [2, 1],
            end=self.now - timedelta(minutes=1, seconds=59),
            windowed_stats=True,
        )

    def test_start_bucket(self):
        self.run_test(self.bucket_incident, [2, 4, 2, 2])

    def test_buckets_already_aligned(self):
        self.bucket_incident.update(
            date_started=self.now - timedelta(minutes=30), date_closed=self.now
        )
        self.run_test(self.bucket_incident, [2, 2, 2])

    def test_start_and_end_bucket(self):
        self.create_event(self.bucket_incident.date_started + timedelta(minutes=19))

        self.bucket_incident.update(
            date_closed=self.bucket_incident.date_started + timedelta(minutes=18)
        )
        self.run_test(self.bucket_incident, [2, 4, 2, 3, 1])

    def test_with_transactions(self):
        incident = self.project_incident
        alert_rule = self.create_alert_rule(
            self.organization, [self.project], query="", time_window=1
        )
        incident.update(alert_rule=alert_rule)

        event_data = load_data("transaction")
        event_data.update(
            {
                "start_timestamp": iso_format(before_now(minutes=2)),
                "timestamp": iso_format(before_now(minutes=2)),
            }
        )
        event_data["transaction"] = "/foo_transaction/"
        self.store_event(data=event_data, project_id=self.project.id)

        self.run_test(incident, [2, 1])


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
        assert get_incident_aggregates(self.project_incident) == {"count": 4, "unique_users": 2}


@freeze_time()
class CreateEventStatTest(TestCase, BaseIncidentsTest):
    def test_simple(self):
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=1))
        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5), query="", projects=[self.project]
        )
        snapshot = create_event_stat_snapshot(incident, windowed_stats=False)
        assert snapshot.start == incident.date_started - timedelta(minutes=1)
        assert snapshot.end == incident.current_end_date + timedelta(minutes=1)
        assert [row[1] for row in snapshot.values] == [2, 1]

        snapshot = create_event_stat_snapshot(incident, windowed_stats=True)
        expected_start, expected_end = calculate_incident_time_range(incident, windowed_stats=True)
        assert snapshot.start == expected_start
        assert snapshot.end == expected_end
        assert [row[1] for row in snapshot.values] == [2, 1]


@freeze_time()
class CreateIncidentActivityTest(TestCase, BaseIncidentsTest):
    send_subscriber_notifications = patcher("sentry.incidents.tasks.send_subscriber_notifications")
    record_event = patcher("sentry.analytics.base.Analytics.record_event")

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
            value=six.text_type(IncidentStatus.CLOSED.value),
            previous_value=six.text_type(IncidentStatus.WARNING.value),
        )
        assert activity.incident == incident
        assert activity.type == IncidentActivityType.STATUS_CHANGE.value
        assert activity.user == self.user
        assert activity.value == six.text_type(IncidentStatus.CLOSED.value)
        assert activity.previous_value == six.text_type(IncidentStatus.WARNING.value)
        self.assert_notifications_sent(activity)
        assert not self.record_event.called

    def test_comment(self):
        incident = self.create_incident()
        comment = "hello"
        with self.assertChanges(
            lambda: IncidentSubscription.objects.filter(incident=incident, user=self.user).exists(),
            before=False,
            after=True,
        ):
            self.record_event.reset_mock()
            activity = create_incident_activity(
                incident, IncidentActivityType.COMMENT, user=self.user, comment=comment
            )
        assert activity.incident == incident
        assert activity.type == IncidentActivityType.COMMENT.value
        assert activity.user == self.user
        assert activity.comment == comment
        assert activity.value is None
        assert activity.previous_value is None
        self.assert_notifications_sent(activity)
        assert len(self.record_event.call_args_list) == 1
        event = self.record_event.call_args[0][0]
        assert isinstance(event, IncidentCommentCreatedEvent)
        assert event.data == {
            "organization_id": six.text_type(self.organization.id),
            "incident_id": six.text_type(incident.id),
            "incident_type": six.text_type(incident.type),
            "user_id": six.text_type(self.user.id),
            "activity_id": six.text_type(activity.id),
        }

    def test_mentioned_user_ids(self):
        incident = self.create_incident()
        mentioned_member = self.create_user()
        subscribed_mentioned_member = self.create_user()
        IncidentSubscription.objects.create(incident=incident, user=subscribed_mentioned_member)
        comment = "hello **@%s** and **@%s**" % (
            mentioned_member.username,
            subscribed_mentioned_member.username,
        )
        with self.assertChanges(
            lambda: IncidentSubscription.objects.filter(
                incident=incident, user=mentioned_member
            ).exists(),
            before=False,
            after=True,
        ):
            self.record_event.reset_mock()
            activity = create_incident_activity(
                incident,
                IncidentActivityType.COMMENT,
                user=self.user,
                comment=comment,
                mentioned_user_ids=[mentioned_member.id, subscribed_mentioned_member.id],
            )
        assert activity.incident == incident
        assert activity.type == IncidentActivityType.COMMENT.value
        assert activity.user == self.user
        assert activity.comment == comment
        assert activity.value is None
        assert activity.previous_value is None
        self.assert_notifications_sent(activity)
        assert len(self.record_event.call_args_list) == 1
        event = self.record_event.call_args[0][0]
        assert isinstance(event, IncidentCommentCreatedEvent)
        assert event.data == {
            "organization_id": six.text_type(self.organization.id),
            "incident_id": six.text_type(incident.id),
            "incident_type": six.text_type(incident.type),
            "user_id": six.text_type(self.user.id),
            "activity_id": six.text_type(activity.id),
        }


class GetIncidentSubscribersTest(TestCase, BaseIncidentsTest):
    def test_simple(self):
        incident = self.create_incident()
        assert list(get_incident_subscribers(incident)) == []
        subscription = subscribe_to_incident(incident, self.user)[0]
        assert list(get_incident_subscribers(incident)) == [subscription]


@freeze_time()
class CreateIncidentSnapshotTest(TestCase, BaseIncidentsTest):
    def test(self):
        incident = self.create_incident(self.organization)
        incident.update(status=IncidentStatus.CLOSED.value)
        snapshot = create_incident_snapshot(incident, windowed_stats=False)
        expected_snapshot = create_event_stat_snapshot(incident, windowed_stats=False)

        assert snapshot.event_stats_snapshot.start == expected_snapshot.start
        assert snapshot.event_stats_snapshot.end == expected_snapshot.end
        assert snapshot.event_stats_snapshot.values == expected_snapshot.values
        assert snapshot.event_stats_snapshot.period == expected_snapshot.period
        assert snapshot.event_stats_snapshot.date_added == expected_snapshot.date_added
        aggregates = get_incident_aggregates(incident)
        assert snapshot.unique_users == aggregates["unique_users"]
        assert snapshot.total_events == aggregates["count"]

    def test_windowed(self):
        incident = self.create_incident(self.organization)
        incident.update(status=IncidentStatus.CLOSED.value)
        snapshot = create_incident_snapshot(incident, windowed_stats=True)
        expected_snapshot = create_event_stat_snapshot(incident, windowed_stats=True)

        assert snapshot.event_stats_snapshot.start == expected_snapshot.start
        assert snapshot.event_stats_snapshot.end == expected_snapshot.end
        assert snapshot.event_stats_snapshot.values == expected_snapshot.values
        assert snapshot.event_stats_snapshot.period == expected_snapshot.period
        assert snapshot.event_stats_snapshot.date_added == expected_snapshot.date_added
        aggregates = get_incident_aggregates(incident)
        assert snapshot.unique_users == aggregates["unique_users"]
        assert snapshot.total_events == aggregates["count"]

    def test_windowed_capped_start(self):
        # When calculating start/end time for long incidents, the start can be
        # further in the past than we support based on an org's retention period.
        # This test ensures we cap the query so we never query further back in time than retention.

        time_window = 1500  # more than 24 hours, so gets capped at 10 days
        alert_rule = self.create_alert_rule(time_window=time_window)

        incident = self.create_incident(self.organization)
        incident.update(
            status=IncidentStatus.CLOSED.value,
            alert_rule=alert_rule,
            date_started=datetime.utcnow() - timedelta(days=100),
            date_closed=datetime.utcnow() - timedelta(days=1),
        )

        start, end = calculate_incident_time_range(incident)
        assert start == datetime.utcnow().replace(tzinfo=pytz.utc) - timedelta(days=90)
        assert end == incident.date_closed.replace(tzinfo=pytz.utc) + timedelta(minutes=time_window)

        incident.update(date_closed=datetime.utcnow() - timedelta(days=95),)

        start, end = calculate_incident_time_range(incident)
        assert start == datetime.utcnow().replace(tzinfo=pytz.utc) - timedelta(days=90)
        assert end == start

    def test_windowed_capped_end(self):
        # When processing PendingIncidentSnapshots, the task could run later than we'd like the
        # end to actually be, so we have logic to cap it to 10 datapoints, or 10 days, whichever is less. This tests that logic.

        time_window = 1500  # more than 24 hours, so gets capped at 10 days
        alert_rule = self.create_alert_rule(time_window=time_window)

        incident = self.create_incident(self.organization)
        incident.update(status=IncidentStatus.CLOSED.value, alert_rule=alert_rule)
        incident.date_closed = timezone.now() - timedelta(days=11)

        start, end = calculate_incident_time_range(incident, windowed_stats=True)
        assert end == incident.current_end_date + timedelta(days=10)

        alert_rule.snuba_query.update(time_window=600)

        start, end = calculate_incident_time_range(incident, windowed_stats=True)
        assert end == incident.current_end_date + timedelta(minutes=100)

    def test_skip_existing(self):
        incident = self.create_incident(self.organization)
        incident.update(status=IncidentStatus.CLOSED.value)
        create_incident_snapshot(incident, windowed_stats=False)
        assert create_incident_snapshot(incident, windowed_stats=False) is None


@freeze_time()
class GetIncidentStatsTest(TestCase, BaseIncidentsTest):
    def run_test(self, incident):
        incident_stats = get_incident_stats(incident, windowed_stats=True)
        event_stats = get_incident_event_stats(incident, windowed_stats=True)
        assert incident_stats["event_stats"].data["data"] == event_stats.data["data"]
        expected_start, expected_end = calculate_incident_time_range(incident, windowed_stats=True)
        assert event_stats.start == expected_start
        assert event_stats.end == expected_end
        assert incident_stats["event_stats"].rollup == event_stats.rollup

        aggregates = get_incident_aggregates(incident)
        assert incident_stats["total_events"] == aggregates["count"]
        assert incident_stats["unique_users"] == aggregates["unique_users"]

    def test_open(self):
        open_incident = self.create_incident(
            self.organization,
            title="Open",
            query="",
            date_started=timezone.now() - timedelta(days=30),
        )
        self.run_test(open_incident)

    def test_closed(self):
        closed_incident = self.create_incident(
            self.organization,
            title="Closed",
            query="",
            date_started=timezone.now() - timedelta(days=30),
        )
        update_incident_status(
            closed_incident,
            IncidentStatus.CLOSED,
            status_method=IncidentStatusMethod.RULE_TRIGGERED,
        )
        self.run_test(closed_incident)

    def test_transaction(self):
        alert_rule = self.create_alert_rule(
            self.organization, dataset=QueryDatasets.TRANSACTIONS, aggregate="p75()"
        )
        open_incident = self.create_incident(
            self.organization,
            title="Open",
            date_started=timezone.now() - timedelta(days=30),
            alert_rule=alert_rule,
        )
        self.run_test(open_incident)

    def test_floats(self):
        alert_rule = self.create_alert_rule(
            self.organization, dataset=QueryDatasets.TRANSACTIONS, aggregate="p75()"
        )
        incident = self.create_incident(
            self.organization,
            title="Hi",
            date_started=timezone.now() - timedelta(days=30),
            alert_rule=alert_rule,
        )
        update_incident_status(
            incident, IncidentStatus.CLOSED, status_method=IncidentStatusMethod.RULE_TRIGGERED
        )
        time_series_values = [[0, 1], [1, 5], [2, 5.5]]
        time_series_snapshot = TimeSeriesSnapshot.objects.create(
            start=timezone.now() - timedelta(hours=1),
            end=timezone.now(),
            values=time_series_values,
            period=3000,
        )
        IncidentSnapshot.objects.create(
            incident=incident,
            event_stats_snapshot=time_series_snapshot,
            unique_users=1234,
            total_events=4567,
        )

        incident_stats = get_incident_stats(incident, windowed_stats=True)
        assert incident_stats["event_stats"].data["data"] == [
            {"time": time, "count": count} for time, count in time_series_values
        ]


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
        assert alert_rule.status == AlertRuleStatus.PENDING.value
        assert alert_rule.snuba_query.subscriptions.all().count() == 1
        assert alert_rule.snuba_query.dataset == QueryDatasets.EVENTS.value
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

    def test_invalid_query(self):
        with self.assertRaises(InvalidSearchQuery):
            create_alert_rule(
                self.organization,
                [self.project],
                "hi",
                "has:",
                "count()",
                1,
                AlertRuleThresholdType.ABOVE,
                1,
            )

    def test_existing_name(self):
        name = "uh oh"
        create_alert_rule(
            self.organization,
            [self.project],
            name,
            "level:error",
            "count()",
            1,
            AlertRuleThresholdType.ABOVE,
            1,
        )
        with self.assertRaises(AlertRuleNameAlreadyUsedError):
            create_alert_rule(
                self.organization,
                [self.project],
                name,
                "level:error",
                "count()",
                1,
                AlertRuleThresholdType.ABOVE,
                1,
            )

    def test_existing_name_allowed_when_archived(self):
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

        assert alert_rule_1.name == alert_rule_2.name
        assert alert_rule_1.status == AlertRuleStatus.SNAPSHOT.value
        assert alert_rule_2.status == AlertRuleStatus.PENDING.value

    # This test will fail unless real migrations are run. Refer to migration 0061.
    @pytest.mark.skipif(
        not settings.MIGRATIONS_TEST_MIGRATE, reason="requires custom migration 0061"
    )
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


class UpdateAlertRuleTest(TestCase, BaseIncidentsTest):
    @fixture
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
        assert set([sub.project for sub in updated_subscriptions]) == set(updated_projects)
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

    def test_empty_query(self):
        alert_rule = update_alert_rule(self.alert_rule, query="")
        assert alert_rule.snuba_query.query == ""

    def test_name_used(self):
        used_name = "uh oh"
        self.create_alert_rule(name=used_name)
        with self.assertRaises(AlertRuleNameAlreadyUsedError):
            update_alert_rule(self.alert_rule, name=used_name)

    def test_invalid_query(self):
        with self.assertRaises(InvalidSearchQuery):
            update_alert_rule(self.alert_rule, query="has:")

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
        assert set([sub.project for sub in updated_subscriptions]) == set(updated_projects)
        for sub in updated_subscriptions:
            assert sub.snuba_query.query == query_update

    def test_update_to_include_all(self):
        orig_project = self.project
        alert_rule = self.create_alert_rule(projects=[orig_project])
        new_project = self.create_project(fire_project_created=True)
        assert not alert_rule.snuba_query.subscriptions.filter(project=new_project).exists()
        update_alert_rule(alert_rule, include_all_projects=True)
        assert set([sub.project for sub in alert_rule.snuba_query.subscriptions.all()]) == set(
            [new_project, orig_project]
        )

    def test_update_to_include_all_with_exclude(self):
        orig_project = self.project
        alert_rule = self.create_alert_rule(projects=[orig_project])
        new_project = self.create_project(fire_project_created=True)
        excluded_project = self.create_project()
        assert not alert_rule.snuba_query.subscriptions.filter(project=new_project).exists()
        update_alert_rule(
            alert_rule, include_all_projects=True, excluded_projects=[excluded_project]
        )
        assert set([sub.project for sub in alert_rule.snuba_query.subscriptions.all()]) == set(
            [orig_project, new_project]
        )

    def test_update_include_all_exclude_list(self):
        new_project = self.create_project(fire_project_created=True)
        projects = set([new_project, self.project])
        alert_rule = self.create_alert_rule(include_all_projects=True)
        assert set([sub.project for sub in alert_rule.snuba_query.subscriptions.all()]) == projects
        with self.tasks():
            update_alert_rule(alert_rule, excluded_projects=[self.project])
        assert [sub.project for sub in alert_rule.snuba_query.subscriptions.all()] == [new_project]

        update_alert_rule(alert_rule, excluded_projects=[])
        assert set([sub.project for sub in alert_rule.snuba_query.subscriptions.all()]) == projects

    def test_update_from_include_all(self):
        new_project = self.create_project(fire_project_created=True)
        projects = set([new_project, self.project])
        alert_rule = self.create_alert_rule(include_all_projects=True)
        assert set([sub.project for sub in alert_rule.snuba_query.subscriptions.all()]) == projects
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
                target_identifier=six.text_type(self.user.id),
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


class DeleteAlertRuleTest(TestCase, BaseIncidentsTest):
    @fixture
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


class EnableAlertRuleTest(TestCase, BaseIncidentsTest):
    @fixture
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
    @fixture
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
    @fixture
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
        with self.assertRaises(ProjectsNotAssociatedWithAlertRuleError):
            create_alert_rule_trigger(alert_rule, "hi", 100, excluded_projects=[other_project])

    def test_existing_label(self):
        name = "uh oh"
        create_alert_rule_trigger(self.alert_rule, name, 100)
        with self.assertRaises(AlertRuleTriggerLabelAlreadyUsedError):
            create_alert_rule_trigger(self.alert_rule, name, 100)


class UpdateAlertRuleTriggerTest(TestCase):
    @fixture
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
        with self.assertRaises(AlertRuleTriggerLabelAlreadyUsedError):
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
        assert set(excluded_projects) == set([other_project, excluded_project])

    def test_excluded_projects_not_associated_with_rule(self):
        other_project = self.create_project(fire_project_created=True)
        alert_rule = self.create_alert_rule(projects=[self.project])
        trigger = create_alert_rule_trigger(alert_rule, "hi", 1000)

        with self.assertRaises(ProjectsNotAssociatedWithAlertRuleError):
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


class BaseAlertRuleTriggerActionTest(object):
    @fixture
    def alert_rule(self):
        return self.create_alert_rule()

    @fixture
    def trigger(self):
        return create_alert_rule_trigger(self.alert_rule, "hello", 1000)


class CreateAlertRuleTriggerActionTest(BaseAlertRuleTriggerActionTest, TestCase):
    def test(self):
        type = AlertRuleTriggerAction.Type.EMAIL
        target_type = AlertRuleTriggerAction.TargetType.USER
        target_identifier = six.text_type(self.user.id)
        action = create_alert_rule_trigger_action(
            self.trigger, type, target_type, target_identifier=target_identifier
        )
        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == target_identifier

    @responses.activate
    def test_slack(self):
        integration = Integration.objects.create(
            external_id="1",
            provider="slack",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.SLACK
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "#some_channel"
        channel_id = "s_c"
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/channels.list",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channels": [{"name": channel_name[1:], "id": channel_id}]}
            ),
        )

        action = create_alert_rule_trigger_action(
            self.trigger, type, target_type, target_identifier=channel_name, integration=integration
        )
        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == channel_id
        assert action.target_display == channel_name
        assert action.integration == integration

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
        with self.assertRaises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=channel_name,
                integration=integration,
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
            self.trigger, type, target_type, target_identifier=channel_name, integration=integration
        )
        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == channel_id
        assert action.target_display == channel_name
        assert action.integration == integration

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

        with self.assertRaises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=channel_name,
                integration=integration,
            )

    def test_pagerduty(self):
        SERVICES = [
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
            metadata={"services": SERVICES},
        )
        integration.add_organization(self.organization, self.user)
        service = PagerDutyService.objects.create(
            service_name=SERVICES[0]["service_name"],
            integration_key=SERVICES[0]["integration_key"],
            organization_integration=integration.organizationintegration_set.first(),
        )
        type = AlertRuleTriggerAction.Type.PAGERDUTY
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        target_identifier = service.id
        action = create_alert_rule_trigger_action(
            self.trigger,
            type,
            target_type,
            target_identifier=target_identifier,
            integration=integration,
        )
        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == target_identifier
        assert action.target_display == "hellboi"
        assert action.integration == integration

    def test_pagerduty_not_existing(self):
        integration = Integration.objects.create(
            provider="pagerduty", name="Example PagerDuty", external_id="example-pagerduty",
        )
        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.PAGERDUTY
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        target_identifier = 1

        with self.assertRaises(InvalidTriggerActionError):
            create_alert_rule_trigger_action(
                self.trigger,
                type,
                target_type,
                target_identifier=target_identifier,
                integration=integration,
            )


class UpdateAlertRuleTriggerAction(BaseAlertRuleTriggerActionTest, TestCase):
    @fixture
    def action(self):
        return create_alert_rule_trigger_action(
            self.trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            target_identifier=six.text_type(self.user.id),
        )

    def test(self):
        type = AlertRuleTriggerAction.Type.EMAIL
        target_type = AlertRuleTriggerAction.TargetType.TEAM
        target_identifier = six.text_type(self.team.id)
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
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.SLACK
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        channel_name = "#some_channel"
        channel_id = "s_c"
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/channels.list",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channels": [{"name": channel_name[1:], "id": channel_id}]}
            ),
        )

        action = update_alert_rule_trigger_action(
            self.action, type, target_type, target_identifier=channel_name, integration=integration
        )
        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == channel_id
        assert action.target_display == channel_name
        assert action.integration == integration

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
        with self.assertRaises(InvalidTriggerActionError):
            update_alert_rule_trigger_action(
                self.action,
                type,
                target_type,
                target_identifier=channel_name,
                integration=integration,
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
            self.action, type, target_type, target_identifier=channel_name, integration=integration
        )
        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == channel_id
        assert action.target_display == channel_name
        assert action.integration == integration

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

        with self.assertRaises(InvalidTriggerActionError):
            update_alert_rule_trigger_action(
                self.action,
                type,
                target_type,
                target_identifier=channel_name,
                integration=integration,
            )

    def test_pagerduty(self):
        SERVICES = [
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
            metadata={"services": SERVICES},
        )
        integration.add_organization(self.organization, self.user)
        service = PagerDutyService.objects.create(
            service_name=SERVICES[0]["service_name"],
            integration_key=SERVICES[0]["integration_key"],
            organization_integration=integration.organizationintegration_set.first(),
        )
        type = AlertRuleTriggerAction.Type.PAGERDUTY
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        target_identifier = service.id
        action = update_alert_rule_trigger_action(
            self.action,
            type,
            target_type,
            target_identifier=target_identifier,
            integration=integration,
        )

        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == target_identifier
        assert action.target_display == "hellboi"
        assert action.integration == integration

    def test_pagerduty_not_existing(self):
        integration = Integration.objects.create(
            provider="pagerduty", name="Example PagerDuty", external_id="example-pagerduty",
        )
        integration.add_organization(self.organization, self.user)
        type = AlertRuleTriggerAction.Type.PAGERDUTY
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        target_identifier = 1

        with self.assertRaises(InvalidTriggerActionError):
            update_alert_rule_trigger_action(
                self.action,
                type,
                target_type,
                target_identifier=target_identifier,
                integration=integration,
            )


class DeleteAlertRuleTriggerAction(BaseAlertRuleTriggerActionTest, TestCase):
    @fixture
    def action(self):
        return create_alert_rule_trigger_action(
            self.trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            target_identifier=six.text_type(self.user.id),
        )

    def test(self):
        action_id = self.action.id
        delete_alert_rule_trigger_action(self.action)
        with self.assertRaises(AlertRuleTriggerAction.DoesNotExist):
            AlertRuleTriggerAction.objects.get(id=action_id)


class GetActionsForTriggerTest(BaseAlertRuleTriggerActionTest, TestCase):
    def test(self):
        assert list(get_actions_for_trigger(self.trigger)) == []
        action = create_alert_rule_trigger_action(
            self.trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            target_identifier=six.text_type(self.user.id),
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
        assert list(get_available_action_integrations_for_org(self.organization)) == [integration]

    def test_mixed(self):
        integration = Integration.objects.create(external_id="1", provider="slack")
        integration.add_organization(self.organization)
        other_integration = Integration.objects.create(external_id="12345", provider="random")
        other_integration.add_organization(self.organization)
        assert list(get_available_action_integrations_for_org(self.organization)) == [integration]


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
    @fixture
    def user(self):
        return self.create_user("test@test.com")

    @fixture
    def team(self):
        team = self.create_team()
        self.create_team_membership(team, user=self.user)
        return team

    @fixture
    def project(self):
        return self.create_project(teams=[self.team], name="foo")

    @fixture
    def other_project(self):
        return self.create_project(teams=[self.team], name="other")

    @fixture
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
            target_identifier=six.text_type(self.user.id),
        )
        return rule

    @fixture
    def trigger(self):
        return self.rule.alertruletrigger_set.get()

    def test_rule_updated(self):
        incident = self.create_incident(alert_rule=self.rule)
        IncidentTrigger.objects.create(
            incident=incident, alert_rule_trigger=self.trigger, status=TriggerStatus.ACTIVE.value,
        )

        with self.tasks(), self.capture_on_commit_callbacks(execute=True):
            update_alert_rule(self.rule, name="some rule updated")

        out = mail.outbox[0]
        assert out.to == [self.user.email]
        assert out.subject == u"[Resolved] {} - {}".format(incident.title, self.project.slug)

    def test_manual_resolve(self):
        incident = self.create_incident(alert_rule=self.rule)
        IncidentTrigger.objects.create(
            incident=incident, alert_rule_trigger=self.trigger, status=TriggerStatus.ACTIVE.value,
        )

        with self.tasks(), self.capture_on_commit_callbacks(execute=True):
            update_incident_status(
                incident=incident,
                status=IncidentStatus.CLOSED,
                status_method=IncidentStatusMethod.MANUAL,
            )

        out = mail.outbox[0]
        assert out.to == [self.user.email]
        assert out.subject == u"[Resolved] {} - {}".format(incident.title, self.project.slug)


class TestDeduplicateTriggerActions(TestCase):
    @fixture
    def critical(self):
        return AlertRuleTrigger(label=CRITICAL_TRIGGER_LABEL)

    @fixture
    def warning(self):
        return AlertRuleTrigger(label=WARNING_TRIGGER_LABEL)

    def run_test(self, input, output):
        assert sorted(deduplicate_trigger_actions(input)) == sorted(output)

    def test_critical_only(self):
        action = AlertRuleTriggerAction(
            alert_rule_trigger=self.critical,
            type=AlertRuleTriggerAction.Type.EMAIL.value,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier="1",
        )
        self.run_test([action], [action])
        self.run_test([action, action], [action])

        other_action = AlertRuleTriggerAction(
            alert_rule_trigger=self.critical,
            type=AlertRuleTriggerAction.Type.EMAIL.value,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier="2",
        )
        self.run_test([action, action, other_action], [action, other_action])
        integration_action = AlertRuleTriggerAction(
            alert_rule_trigger=self.critical,
            type=AlertRuleTriggerAction.Type.SLACK.value,
            integration_id=1,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            target_identifier="D12345",
        )
        app_action = AlertRuleTriggerAction(
            alert_rule_trigger=self.critical,
            type=AlertRuleTriggerAction.Type.MSTEAMS.value,
            integration_id=1,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            target_identifier="D12345",
        )
        self.run_test(
            [action, action, other_action, integration_action, app_action],
            [action, other_action, integration_action, app_action],
        )
        self.run_test(
            [
                action,
                action,
                other_action,
                other_action,
                integration_action,
                integration_action,
                app_action,
                app_action,
            ],
            [action, other_action, integration_action, app_action],
        )

    def test_critical_warning(self):
        action_c = AlertRuleTriggerAction(
            alert_rule_trigger=self.critical,
            type=AlertRuleTriggerAction.Type.EMAIL.value,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier="1",
        )
        action_w = AlertRuleTriggerAction(
            alert_rule_trigger=self.warning,
            type=AlertRuleTriggerAction.Type.EMAIL.value,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier="1",
        )
        self.run_test([action_w, action_c, action_c], [action_c])
        other_action_w = AlertRuleTriggerAction(
            alert_rule_trigger=self.warning,
            type=AlertRuleTriggerAction.Type.EMAIL.value,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier="2",
        )
        self.run_test([action_w, action_c, action_c, other_action_w], [action_c, other_action_w])
        integration_action_w = AlertRuleTriggerAction(
            alert_rule_trigger=self.warning,
            type=AlertRuleTriggerAction.Type.SLACK.value,
            integration_id=1,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            target_identifier="D12345",
        )
        app_action_w = AlertRuleTriggerAction(
            alert_rule_trigger=self.warning,
            type=AlertRuleTriggerAction.Type.MSTEAMS.value,
            integration_id=1,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            target_identifier="D12345",
        )
        self.run_test(
            [action_w, action_c, action_c, other_action_w, integration_action_w, app_action_w],
            [action_c, other_action_w, integration_action_w, app_action_w],
        )
        integration_action_c = AlertRuleTriggerAction(
            alert_rule_trigger=self.critical,
            type=AlertRuleTriggerAction.Type.SLACK.value,
            integration_id=1,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            target_identifier="D12345",
        )
        app_action_c = AlertRuleTriggerAction(
            alert_rule_trigger=self.critical,
            type=AlertRuleTriggerAction.Type.MSTEAMS.value,
            integration_id=1,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            target_identifier="D12345",
        )
        self.run_test(
            [
                action_w,
                action_c,
                action_c,
                other_action_w,
                integration_action_w,
                app_action_w,
                integration_action_c,
                app_action_c,
            ],
            [action_c, other_action_w, integration_action_c, app_action_c],
        )
