from __future__ import absolute_import
import json
import pytest
from uuid import uuid4
import responses
from datetime import timedelta
from exam import fixture, patcher
from freezegun import freeze_time

import six
from django.conf import settings
from django.utils import timezone
from django.utils.functional import cached_property

from sentry.api.event_search import InvalidSearchQuery
from sentry.incidents.events import (
    IncidentCommentCreatedEvent,
    IncidentCreatedEvent,
    IncidentStatusUpdatedEvent,
)
from sentry.incidents.logic import (
    AlertRuleNameAlreadyUsedError,
    AlertRuleTriggerLabelAlreadyUsedError,
    get_incident_stats,
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    create_event_stat_snapshot,
    calculate_incident_time_range,
    create_incident,
    create_incident_activity,
    create_incident_snapshot,
    delete_alert_rule,
    delete_alert_rule_trigger,
    delete_alert_rule_trigger_action,
    DEFAULT_ALERT_RULE_RESOLUTION,
    WINDOWED_STATS_DATA_POINTS,
    get_actions_for_trigger,
    get_available_action_integrations_for_org,
    get_excluded_projects_for_alert_rule,
    get_incident_aggregates,
    get_incident_event_stats,
    get_incident_subscribers,
    get_triggers_for_alert_rule,
    ProjectsNotAssociatedWithAlertRuleError,
    subscribe_to_incident,
    update_alert_rule,
    update_alert_rule_trigger_action,
    update_alert_rule_trigger,
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
    PendingIncidentSnapshot,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentSubscription,
    IncidentType,
)
from sentry.snuba.models import QueryDatasets
from sentry.models.integration import Integration
from sentry.testutils import TestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils.samples import load_data


class CreateIncidentTest(TestCase):
    record_event = patcher("sentry.analytics.base.Analytics.record_event")

    def test_simple(self):
        incident_type = IncidentType.ALERT_TRIGGERED
        title = "hello"
        date_started = timezone.now()
        alert_rule = create_alert_rule(
            self.organization, [self.project], "hello", "level:error", "count()", 10, 1
        )

        self.record_event.reset_mock()
        incident = create_incident(
            self.organization,
            type_=incident_type,
            title=title,
            date_started=date_started,
            projects=[self.project],
            alert_rule=alert_rule,
        )
        assert incident.identifier == 1
        assert incident.status == IncidentStatus.OPEN.value
        assert incident.type == incident_type.value
        assert incident.title == title
        assert incident.date_started == date_started
        assert incident.date_detected == date_started
        assert incident.alert_rule == alert_rule
        assert IncidentProject.objects.filter(
            incident=incident, project__in=[self.project]
        ).exists()
        assert (
            IncidentActivity.objects.filter(
                incident=incident, type=IncidentActivityType.DETECTED.value
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

    def run_test(self, incident, status, expected_date_closed, user=None, comment=None):
        prev_status = incident.status
        self.record_event.reset_mock()
        update_incident_status(
            incident,
            status,
            user=user,
            comment=comment,
            status_method=IncidentStatusMethod.RULE_TRIGGERED,
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


class BaseIncidentsTest(SnubaTestCase):
    def create_event(self, timestamp, fingerprint=None, user=None):
        event_id = uuid4().hex
        if fingerprint is None:
            fingerprint = event_id

        data = {
            "event_id": event_id,
            "fingerprint": [fingerprint],
            "timestamp": iso_format(timestamp),
            "type": "error",
            # This is necessary because event type error should not exist without
            # an exception being in the payload
            "exception": [{"type": "Foo"}],
        }
        if user:
            data["user"] = user
        return self.store_event(data=data, project_id=self.project.id)

    @cached_property
    def now(self):
        return timezone.now().replace(microsecond=0)


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
        expected_start = start if start else incident.date_started - timedelta(minutes=1)
        expected_end = end if end else incident.current_end_date + timedelta(minutes=1)

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

    def test_windowed_capped_end(self):
        # When processing PendingIncidentSnapshots, the task could run later than we'd like the
        # end to actually be, so we have logic to cap it to 10 datapoints, or 10 days, whichever is less. This tests that logic.

        time_window = 1500  # more than 24 hours, so gets capped at 10 days
        alert_rule = create_alert_rule(
            self.organization, [self.project], "hello", "level:error", "count()", time_window, 1
        )

        incident = self.create_incident(self.organization)
        incident.update(status=IncidentStatus.CLOSED.value, alert_rule=alert_rule)
        incident.date_closed = timezone.now() - timedelta(days=11)

        start, end = calculate_incident_time_range(incident, windowed_stats=True)
        assert end == incident.current_end_date + timedelta(days=10)

        alert_rule.snuba_query.update(time_window=600)

        start, end = calculate_incident_time_range(incident, windowed_stats=True)
        assert end == incident.current_end_date + timedelta(minutes=100)


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


class CreateAlertRuleTest(TestCase, BaseIncidentsTest):
    def test(self):
        name = "hello"
        query = "level:error"
        aggregate = "count(*)"
        time_window = 10
        threshold_period = 1
        alert_rule = create_alert_rule(
            self.organization, [self.project], name, query, aggregate, time_window, threshold_period
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
            create_alert_rule(self.organization, [self.project], "hi", "has:", "count()", 1, 1)

    def test_existing_name(self):
        name = "uh oh"
        create_alert_rule(self.organization, [self.project], name, "level:error", "count()", 1, 1)
        with self.assertRaises(AlertRuleNameAlreadyUsedError):
            create_alert_rule(
                self.organization, [self.project], name, "level:error", "count()", 1, 1
            )

    def test_existing_name_allowed_when_archived(self):
        name = "allowed"
        alert_rule_1 = create_alert_rule(
            self.organization, [self.project], name, "level:error", "count()", 1, 1
        )
        alert_rule_1.update(status=AlertRuleStatus.SNAPSHOT.value)

        alert_rule_2 = create_alert_rule(
            self.organization, [self.project], name, "level:error", "count()", 1, 1
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
            self.organization, [self.project], name, "level:error", "count()", 1, 1
        )
        alert_rule_1.update(status=AlertRuleStatus.SNAPSHOT.value)

        alert_rule_2 = create_alert_rule(
            self.organization, [self.project], name, "level:error", "count()", 1, 1
        )
        alert_rule_2.update(status=AlertRuleStatus.SNAPSHOT.value)

        assert alert_rule_1.name == alert_rule_2.name
        assert alert_rule_1.status == AlertRuleStatus.SNAPSHOT.value
        assert alert_rule_2.status == AlertRuleStatus.SNAPSHOT.value


class UpdateAlertRuleTest(TestCase, BaseIncidentsTest):
    @fixture
    def alert_rule(self):
        return create_alert_rule(
            self.organization, [self.project], "hello", "level:error", "count()", 10, 1
        )

    def test(self):
        name = "uh oh"
        query = "level:warning"
        aggregate = "count_unique(tags[sentry:user])"
        time_window = 50
        threshold_period = 2

        updated_projects = [self.project, self.create_project(fire_project_created=True)]

        updated_rule = update_alert_rule(
            self.alert_rule,
            projects=updated_projects,
            name=name,
            query=query,
            aggregate=aggregate,
            time_window=time_window,
            threshold_period=threshold_period,
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
        create_alert_rule(
            self.organization, [self.project], used_name, "level:error", "count()", 10, 1
        )
        with self.assertRaises(AlertRuleNameAlreadyUsedError):
            update_alert_rule(self.alert_rule, name=used_name)

    def test_invalid_query(self):
        with self.assertRaises(InvalidSearchQuery):
            update_alert_rule(self.alert_rule, query="has:")

    def test_delete_projects(self):
        alert_rule = create_alert_rule(
            self.organization,
            [self.project, self.create_project(fire_project_created=True)],
            "something",
            "level:error",
            "count()",
            10,
            1,
        )
        update_alert_rule(alert_rule, projects=[self.project])
        assert self.alert_rule.snuba_query.subscriptions.get().project == self.project

    def test_new_updated_deleted_projects(self):
        alert_rule = create_alert_rule(
            self.organization,
            [self.project, self.create_project(fire_project_created=True)],
            "something",
            "level:error",
            "count()",
            10,
            1,
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
            trigger = create_alert_rule_trigger(
                self.alert_rule, "hello", AlertRuleThresholdType.ABOVE, 1000, 400
            )
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
            assert trigger_snapshot.threshold_type == trigger.threshold_type
            assert trigger_snapshot.alert_threshold == trigger.alert_threshold
            assert trigger_snapshot.resolve_threshold == trigger.resolve_threshold

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
        return create_alert_rule(
            self.organization, [self.project], "hello", "level:error", "count()", 10, 1
        )

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
        threshold_type = AlertRuleThresholdType.ABOVE
        alert_threshold = 1000
        resolve_threshold = 400
        trigger = create_alert_rule_trigger(
            self.alert_rule, label, threshold_type, alert_threshold, resolve_threshold
        )
        assert trigger.label == label
        assert trigger.threshold_type == threshold_type.value
        assert trigger.alert_threshold == alert_threshold
        assert trigger.resolve_threshold == resolve_threshold
        assert not AlertRuleTriggerExclusion.objects.filter(alert_rule_trigger=trigger).exists()

    def test_excluded_projects(self):
        excluded_project = self.create_project(fire_project_created=True)
        alert_rule = self.create_alert_rule(projects=[self.project, excluded_project])
        trigger = create_alert_rule_trigger(
            alert_rule,
            "hi",
            AlertRuleThresholdType.ABOVE,
            100,
            excluded_projects=[excluded_project],
        )
        # We should have only one exclusion
        exclusion = AlertRuleTriggerExclusion.objects.get(alert_rule_trigger=trigger)
        assert exclusion.query_subscription.project == excluded_project

    def test_excluded_projects_not_associated_with_rule(self):
        other_project = self.create_project(fire_project_created=True)
        alert_rule = self.create_alert_rule(projects=[self.project])
        with self.assertRaises(ProjectsNotAssociatedWithAlertRuleError):
            create_alert_rule_trigger(
                alert_rule,
                "hi",
                AlertRuleThresholdType.ABOVE,
                100,
                excluded_projects=[other_project],
            )

    def test_existing_label(self):
        name = "uh oh"
        create_alert_rule_trigger(self.alert_rule, name, AlertRuleThresholdType.ABOVE, 100)
        with self.assertRaises(AlertRuleTriggerLabelAlreadyUsedError):
            create_alert_rule_trigger(self.alert_rule, name, AlertRuleThresholdType.ABOVE, 100)


class UpdateAlertRuleTriggerTest(TestCase):
    @fixture
    def alert_rule(self):
        return self.create_alert_rule()

    def test(self):
        trigger = create_alert_rule_trigger(
            self.alert_rule, "hello", AlertRuleThresholdType.ABOVE, 1000, 400
        )

        label = "uh oh"
        threshold_type = AlertRuleThresholdType.BELOW
        alert_threshold = 2000
        resolve_threshold = 800
        trigger = update_alert_rule_trigger(
            trigger,
            label=label,
            threshold_type=threshold_type,
            alert_threshold=alert_threshold,
            resolve_threshold=resolve_threshold,
        )
        assert trigger.label == label
        assert trigger.threshold_type == threshold_type.value
        assert trigger.alert_threshold == alert_threshold
        assert trigger.resolve_threshold == resolve_threshold

    def test_name_used(self):
        label = "uh oh"
        create_alert_rule_trigger(self.alert_rule, label, AlertRuleThresholdType.ABOVE, 1000, 400)
        trigger = create_alert_rule_trigger(
            self.alert_rule, "something else", AlertRuleThresholdType.ABOVE, 1000, 400
        )
        with self.assertRaises(AlertRuleTriggerLabelAlreadyUsedError):
            update_alert_rule_trigger(trigger, label=label)

    def test_exclude_projects(self):
        other_project = self.create_project(fire_project_created=True)

        alert_rule = self.create_alert_rule(projects=[other_project, self.project])
        trigger = create_alert_rule_trigger(
            alert_rule, "hi", AlertRuleThresholdType.ABOVE, 1000, 400
        )
        update_alert_rule_trigger(trigger, excluded_projects=[other_project])
        assert trigger.exclusions.get().query_subscription.project == other_project

    def test_complex_exclude_projects(self):
        excluded_project = self.create_project()
        other_project = self.create_project(fire_project_created=True)

        alert_rule = self.create_alert_rule(
            projects=[excluded_project, self.project, other_project]
        )
        trigger = create_alert_rule_trigger(
            alert_rule,
            "hi",
            AlertRuleThresholdType.ABOVE,
            1000,
            400,
            excluded_projects=[excluded_project, self.project],
        )
        update_alert_rule_trigger(trigger, excluded_projects=[other_project, excluded_project])
        excluded_projects = [
            exclusion.query_subscription.project for exclusion in trigger.exclusions.all()
        ]
        assert set(excluded_projects) == set([other_project, excluded_project])

    def test_excluded_projects_not_associated_with_rule(self):
        other_project = self.create_project(fire_project_created=True)
        alert_rule = self.create_alert_rule(projects=[self.project])
        trigger = create_alert_rule_trigger(
            alert_rule, "hi", AlertRuleThresholdType.ABOVE, 1000, 400
        )

        with self.assertRaises(ProjectsNotAssociatedWithAlertRuleError):
            update_alert_rule_trigger(trigger, excluded_projects=[other_project])


class DeleteAlertRuleTriggerTest(TestCase):
    def test(self):
        alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(
            alert_rule,
            "hi",
            AlertRuleThresholdType.ABOVE,
            1000,
            400,
            excluded_projects=[self.project],
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
        trigger = create_alert_rule_trigger(
            alert_rule, "hi", AlertRuleThresholdType.ABOVE, 1000, 400
        )
        assert get_triggers_for_alert_rule(alert_rule).get() == trigger


class BaseAlertRuleTriggerActionTest(object):
    @fixture
    def alert_rule(self):
        return self.create_alert_rule()

    @fixture
    def trigger(self):
        return create_alert_rule_trigger(
            self.alert_rule, "hello", AlertRuleThresholdType.ABOVE, 1000, 400
        )


class CreateAlertRuleTriggerAction(BaseAlertRuleTriggerActionTest, TestCase):
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
