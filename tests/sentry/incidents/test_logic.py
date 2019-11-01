from __future__ import absolute_import

from datetime import timedelta
from exam import fixture, patcher
from freezegun import freeze_time

from uuid import uuid4

import six
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
    bulk_build_incident_query_params,
    bulk_get_incident_aggregates,
    bulk_get_incident_event_stats,
    bulk_get_incident_stats,
    calculate_incident_start,
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    create_event_stat_snapshot,
    create_incident,
    create_incident_activity,
    create_incident_snapshot,
    create_initial_event_stats_snapshot,
    delete_alert_rule,
    delete_alert_rule_trigger,
    delete_alert_rule_trigger_action,
    DEFAULT_ALERT_RULE_RESOLUTION,
    get_actions_for_trigger,
    get_excluded_projects_for_alert_rule,
    get_incident_aggregates,
    get_incident_event_stats,
    get_incident_subscribers,
    get_incident_suspect_commits,
    get_incident_suspects,
    get_triggers_for_alert_rule,
    INCIDENT_START_ROLLUP,
    ProjectsNotAssociatedWithAlertRuleError,
    subscribe_to_incident,
    StatusAlreadyChangedError,
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
    IncidentGroup,
    IncidentProject,
    IncidentSnapshot,
    IncidentStatus,
    IncidentSubscription,
    IncidentSuspectCommit,
    IncidentType,
)
from sentry.snuba.models import QueryAggregations, QueryDatasets, QuerySubscription
from sentry.models.commit import Commit
from sentry.models.repository import Repository
from sentry.testutils import TestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class CreateIncidentTest(TestCase):
    record_event = patcher("sentry.analytics.base.Analytics.record_event")
    calculate_incident_suspects = patcher("sentry.incidents.tasks.calculate_incident_suspects")

    def test_simple(self):
        incident_type = IncidentType.CREATED
        title = "hello"
        query = "goodbye"
        aggregation = QueryAggregations.UNIQUE_USERS
        date_started = timezone.now()
        other_project = self.create_project(fire_project_created=True)
        other_group = self.create_group(project=other_project)
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "hello",
            "level:error",
            QueryAggregations.TOTAL,
            10,
            1,
        )

        self.record_event.reset_mock()
        incident = create_incident(
            self.organization,
            type=incident_type,
            title=title,
            query=query,
            aggregation=aggregation,
            date_started=date_started,
            projects=[self.project],
            groups=[self.group, other_group],
            alert_rule=alert_rule,
        )
        assert incident.identifier == 1
        assert incident.status == incident_type.value
        assert incident.title == title
        assert incident.query == query
        assert incident.aggregation == aggregation.value
        assert incident.date_started == date_started
        assert incident.date_detected == date_started
        assert incident.alert_rule == alert_rule
        assert (
            IncidentGroup.objects.filter(
                incident=incident, group__in=[self.group, other_group]
            ).count()
            == 2
        )
        assert (
            IncidentProject.objects.filter(
                incident=incident, project__in=[self.project, other_project]
            ).count()
            == 2
        )
        assert (
            IncidentActivity.objects.filter(
                incident=incident,
                type=IncidentActivityType.CREATED.value,
                event_stats_snapshot__isnull=False,
            ).count()
            == 1
        )
        assert len(self.record_event.call_args_list) == 1
        event = self.record_event.call_args[0][0]
        assert isinstance(event, IncidentCreatedEvent)
        assert event.data == {
            "organization_id": six.text_type(self.organization.id),
            "incident_id": six.text_type(incident.id),
            "incident_type": six.text_type(IncidentType.CREATED.value),
        }
        self.calculate_incident_suspects.apply_async.assert_called_once_with(
            kwargs={"incident_id": incident.id}
        )


@freeze_time()
class UpdateIncidentStatus(TestCase):
    record_event = patcher("sentry.analytics.base.Analytics.record_event")

    def get_most_recent_incident_activity(self, incident):
        return IncidentActivity.objects.filter(incident=incident).order_by("-id")[:1].get()

    def test_status_already_set(self):
        incident = self.create_incident(status=IncidentStatus.OPEN.value)
        with self.assertRaises(StatusAlreadyChangedError):
            update_incident_status(incident, IncidentStatus.OPEN)

    def run_test(self, incident, status, expected_date_closed, user=None, comment=None):
        prev_status = incident.status
        self.record_event.reset_mock()
        update_incident_status(incident, status, user=user, comment=comment)
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
        assert activity.event_stats_snapshot is None

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
        incident = create_incident(
            self.organization,
            IncidentType.CREATED,
            "Test",
            "",
            QueryAggregations.TOTAL,
            timezone.now(),
            projects=[self.project],
        )
        with self.assertChanges(
            lambda: IncidentSnapshot.objects.filter(incident=incident).exists(),
            before=False,
            after=True,
        ):
            self.run_test(incident, IncidentStatus.CLOSED, timezone.now())

    def test_reopened(self):
        incident = create_incident(
            self.organization,
            IncidentType.CREATED,
            "Test",
            "",
            QueryAggregations.TOTAL,
            timezone.now(),
            projects=[self.project],
        )
        update_incident_status(incident, IncidentStatus.CLOSED)
        with self.assertChanges(
            lambda: IncidentSnapshot.objects.filter(incident=incident).exists(),
            before=True,
            after=False,
        ):
            self.run_test(incident, IncidentStatus.OPEN, None)

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


class GetIncidentEventStatsTest(TestCase, BaseIncidentEventStatsTest):
    def run_test(self, incident, expected_results, start=None, end=None):
        kwargs = {}
        if start is not None:
            kwargs["start"] = start
        if end is not None:
            kwargs["end"] = end

        result = get_incident_event_stats(incident, data_points=20, **kwargs)
        # Duration of 300s / 20 data points
        assert result.rollup == 15
        assert result.start == start if start else incident.date_started
        assert result.end == end if end else incident.current_end_date
        assert [r["count"] for r in result.data["data"]] == expected_results

    def test_project(self):
        self.run_test(self.project_incident, [2, 1])
        self.run_test(self.project_incident, [1], start=self.now - timedelta(minutes=1))
        self.run_test(self.project_incident, [2], end=self.now - timedelta(minutes=1, seconds=59))

    def test_groups(self):
        self.run_test(self.group_incident, [1, 1])


class BulkGetIncidentEventStatsTest(TestCase, BaseIncidentEventStatsTest):
    def run_test(self, incidents, expected_results_list, start=None, end=None):
        query_params_list = bulk_build_incident_query_params(incidents, start=start, end=end)
        results = bulk_get_incident_event_stats(incidents, query_params_list, data_points=20)
        for incident, result, expected_results in zip(incidents, results, expected_results_list):
            # Duration of 300s / 20 data points
            assert result.rollup == 15
            assert result.start == start if start else incident.date_started
            assert result.end == end if end else incident.current_end_date
            assert [r["count"] for r in result.data["data"]] == expected_results

    def test_project(self):
        other_project = self.create_project(fire_project_created=True)
        other_incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query="",
            projects=[other_project],
            groups=[],
        )
        incidents = [self.project_incident, other_incident]
        self.run_test(incidents, [[2, 1], []])
        self.run_test(incidents, [[1], []], start=self.now - timedelta(minutes=1))
        self.run_test(incidents, [[2], []], end=self.now - timedelta(minutes=1, seconds=59))

    def test_groups(self):
        other_group = self.create_group()
        other_incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query="",
            projects=[],
            groups=[other_group],
        )

        self.run_test([self.group_incident, other_incident], [[1, 1], []])


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

    @property
    def group_incident(self):
        fp = "group"
        group = self.create_event(self.now - timedelta(minutes=1), fingerprint=fp).group
        self.create_event(self.now - timedelta(minutes=2), user={"id": 123}, fingerprint=fp)
        self.create_event(self.now - timedelta(minutes=2), user={"id": 123}, fingerprint=fp)
        self.create_event(self.now - timedelta(minutes=2), user={"id": 123}, fingerprint="other")
        self.create_event(self.now - timedelta(minutes=2), user={"id": 124}, fingerprint=fp)
        self.create_event(self.now - timedelta(minutes=2), user={"id": 124}, fingerprint="other")
        return self.create_incident(
            date_started=self.now - timedelta(minutes=5), query="", projects=[], groups=[group]
        )


class GetIncidentAggregatesTest(TestCase, BaseIncidentAggregatesTest):
    def test_projects(self):
        assert get_incident_aggregates(self.project_incident) == {"count": 4, "unique_users": 2}

    def test_groups(self):
        assert get_incident_aggregates(self.group_incident) == {"count": 4, "unique_users": 2}


class BulkGetIncidentAggregatesTest(TestCase, BaseIncidentAggregatesTest):
    def test_projects(self):
        other_project = self.create_project(fire_project_created=True)
        other_incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query="",
            projects=[other_project],
            groups=[],
        )
        params = bulk_build_incident_query_params([self.project_incident, other_incident])

        assert bulk_get_incident_aggregates(params) == [
            {"count": 4, "unique_users": 2},
            {"count": 0, "unique_users": 0},
        ]

    def test_groups(self):
        other_group = self.create_group()
        other_incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query="",
            projects=[],
            groups=[other_group],
        )

        params = bulk_build_incident_query_params([self.group_incident, other_incident])
        assert bulk_get_incident_aggregates(params) == [
            {"count": 4, "unique_users": 2},
            {"count": 0, "unique_users": 0},
        ]


@freeze_time()
class CreateEventStatTest(TestCase, BaseIncidentsTest):
    def test_simple(self):
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=1))
        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5), query="", projects=[self.project]
        )
        snapshot = create_event_stat_snapshot(
            incident, incident.date_started, incident.current_end_date
        )
        assert snapshot.start == incident.date_started
        assert snapshot.end == incident.current_end_date
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
            previous_value=six.text_type(IncidentStatus.OPEN.value),
        )
        assert activity.incident == incident
        assert activity.type == IncidentActivityType.STATUS_CHANGE.value
        assert activity.user == self.user
        assert activity.value == six.text_type(IncidentStatus.CLOSED.value)
        assert activity.previous_value == six.text_type(IncidentStatus.OPEN.value)
        self.assert_notifications_sent(activity)
        assert not self.record_event.called

    def test_snapshot(self):
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=1))
        # Define events outside incident range. Should be included in the
        # snapshot
        self.create_event(self.now - timedelta(minutes=20))
        self.create_event(self.now - timedelta(minutes=30))

        # Too far out, should be excluded
        self.create_event(self.now - timedelta(minutes=100))

        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5), query="", projects=[self.project]
        )
        event_stats_snapshot = create_initial_event_stats_snapshot(incident)
        self.record_event.reset_mock()
        activity = create_incident_activity(
            incident, IncidentActivityType.CREATED, event_stats_snapshot=event_stats_snapshot
        )
        assert activity.incident == incident
        assert activity.type == IncidentActivityType.CREATED.value
        assert activity.value is None
        assert activity.previous_value is None

        assert event_stats_snapshot == activity.event_stats_snapshot
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


class CreateInitialEventStatsSnapshotTest(TestCase, BaseIncidentsTest):
    def test_snapshot(self):
        with freeze_time(self.now):
            self.create_event(self.now - timedelta(minutes=2))
            self.create_event(self.now - timedelta(minutes=2))
            self.create_event(self.now - timedelta(minutes=1))
            # Define events outside incident range. Should be included in the
            # snapshot
            self.create_event(self.now - timedelta(minutes=15))
            self.create_event(self.now - timedelta(minutes=20))

            # Too far out, should be excluded
            self.create_event(self.now - timedelta(minutes=100))

            incident = self.create_incident(
                date_started=self.now - timedelta(minutes=5), query="", projects=[self.project]
            )
            event_stat_snapshot = create_initial_event_stats_snapshot(incident)
            assert event_stat_snapshot.start == self.now - timedelta(minutes=20)
            assert [row[1] for row in event_stat_snapshot.values] == [1, 1, 2, 1]


class GetIncidentSubscribersTest(TestCase, BaseIncidentsTest):
    def test_simple(self):
        incident = self.create_incident()
        assert list(get_incident_subscribers(incident)) == []
        subscription = subscribe_to_incident(incident, self.user)[0]
        assert list(get_incident_subscribers(incident)) == [subscription]


class GetIncidentSuspectsTest(TestCase, BaseIncidentsTest):
    def test_simple(self):
        release = self.create_release(project=self.project, version="v12")

        self.repo = Repository.objects.create(
            organization_id=self.organization.id, name=self.organization.id
        )
        commit_id = "a" * 40
        release.set_commits(
            [
                {
                    "id": commit_id,
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                }
            ]
        )
        incident = self.create_incident(self.organization)
        commit = Commit.objects.get(releasecommit__release=release)
        IncidentSuspectCommit.objects.create(incident=incident, commit=commit, order=1)
        assert [commit] == list(get_incident_suspects(incident, [self.project]))
        assert [] == list(get_incident_suspects(incident, []))


class GetIncidentSuspectCommitsTest(TestCase, BaseIncidentsTest):
    def test_simple(self):
        release = self.create_release(project=self.project, version="v12")

        included_commits = set([letter * 40 for letter in ("a", "b", "c", "d")])
        commit_iter = iter(included_commits)

        one_min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={
                "fingerprint": ["group-1"],
                "message": "Kaboom!",
                "platform": "python",
                "stacktrace": {
                    "frames": [
                        {"filename": "sentry/tasks.py"},
                        {"filename": "sentry/models/release.py"},
                    ]
                },
                "release": release.version,
                "timestamp": one_min_ago,
            },
            project_id=self.project.id,
        )
        group = event.group
        self.repo = Repository.objects.create(
            organization_id=self.organization.id, name=self.organization.id
        )
        release.set_commits(
            [
                {
                    "id": next(commit_iter),
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "src/sentry/models/release.py", "type": "M"}],
                },
                {
                    "id": next(commit_iter),
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "src/sentry/models/release.py", "type": "M"}],
                },
                {
                    "id": next(commit_iter),
                    "repository": self.repo.name,
                    "author_email": "ross@example.com",
                    "author_name": "Ross",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "src/sentry/models/release.py", "type": "M"}],
                },
            ]
        )
        release_2 = self.create_release(project=self.project, version="v13")
        event_2 = self.store_event(
            data={
                "fingerprint": ["group-2"],
                "message": "Kaboom!",
                "platform": "python",
                "stacktrace": {
                    "frames": [
                        {"filename": "sentry/tasks.py"},
                        {"filename": "sentry/models/group.py"},
                    ]
                },
                "release": release_2.version,
                "timestamp": one_min_ago,
            },
            project_id=self.project.id,
        )
        group_2 = event_2.group
        excluded_id = "z" * 40
        release_2.set_commits(
            [
                {
                    "id": next(commit_iter),
                    "repository": self.repo.name,
                    "author_email": "hello@example.com",
                    "author_name": "Hello",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "src/sentry/models/group.py", "type": "M"}],
                },
                {
                    "id": excluded_id,
                    "repository": self.repo.name,
                    "author_email": "hello@example.com",
                    "author_name": "Hello",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "src/sentry/models/not_group.py", "type": "M"}],
                },
            ]
        )

        commit_ids = (
            Commit.objects.filter(releasecommit__release__in=[release, release_2])
            .exclude(key=excluded_id)
            .values_list("id", flat=True)
        )
        incident = self.create_incident(self.organization, groups=[group, group_2])
        assert set(get_incident_suspect_commits(incident)) == set(commit_ids)


@freeze_time()
class CreateIncidentSnapshotTest(TestCase, BaseIncidentsTest):
    def test(self):
        incident = self.create_incident(self.organization)
        incident.update(status=IncidentStatus.CLOSED.value)
        snapshot = create_incident_snapshot(incident)
        expected_snapshot = create_event_stat_snapshot(
            incident, incident.date_started, incident.date_closed
        )

        assert snapshot.event_stats_snapshot.start == expected_snapshot.start
        assert snapshot.event_stats_snapshot.end == expected_snapshot.end
        assert snapshot.event_stats_snapshot.values == expected_snapshot.values
        assert snapshot.event_stats_snapshot.period == expected_snapshot.period
        assert snapshot.event_stats_snapshot.date_added == expected_snapshot.date_added
        aggregates = get_incident_aggregates(incident)
        assert snapshot.unique_users == aggregates["unique_users"]
        assert snapshot.total_events == aggregates["count"]


@freeze_time()
class BulkGetIncidentStatusTest(TestCase, BaseIncidentsTest):
    def test(self):
        closed_incident = create_incident(
            self.organization,
            IncidentType.CREATED,
            "Closed",
            "",
            QueryAggregations.TOTAL,
            groups=[self.group],
            date_started=timezone.now() - timedelta(days=30),
        )
        update_incident_status(closed_incident, IncidentStatus.CLOSED)
        open_incident = create_incident(
            self.organization,
            IncidentType.CREATED,
            "Open",
            "",
            QueryAggregations.TOTAL,
            groups=[self.group],
            date_started=timezone.now() - timedelta(days=30),
        )
        incidents = [closed_incident, open_incident]

        for incident, incident_stats in zip(incidents, bulk_get_incident_stats(incidents)):
            event_stats = get_incident_event_stats(incident)
            assert incident_stats["event_stats"].data["data"] == event_stats.data["data"]
            assert incident_stats["event_stats"].start == event_stats.start
            assert incident_stats["event_stats"].end == event_stats.end
            assert incident_stats["event_stats"].rollup == event_stats.rollup

            aggregates = get_incident_aggregates(incident)
            assert incident_stats["total_events"] == aggregates["count"]
            assert incident_stats["unique_users"] == aggregates["unique_users"]


class CreateAlertRuleTest(TestCase, BaseIncidentsTest):
    def test(self):
        name = "hello"
        query = "level:error"
        aggregation = QueryAggregations.TOTAL
        time_window = 10
        threshold_period = 1
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            name,
            query,
            aggregation,
            time_window,
            threshold_period,
        )
        assert alert_rule.query_subscriptions.get().project == self.project
        assert alert_rule.name == name
        assert alert_rule.status == AlertRuleStatus.PENDING.value
        assert alert_rule.query_subscriptions.all().count() == 1
        assert alert_rule.dataset == QueryDatasets.EVENTS.value
        assert alert_rule.query == query
        assert alert_rule.aggregation == aggregation.value
        assert alert_rule.time_window == time_window
        assert alert_rule.resolution == DEFAULT_ALERT_RULE_RESOLUTION
        assert alert_rule.threshold_period == threshold_period

    def test_include_all_projects(self):
        include_all_projects = True
        self.project
        alert_rule = self.create_alert_rule(projects=[], include_all_projects=include_all_projects)
        assert alert_rule.query_subscriptions.get().project == self.project
        assert alert_rule.include_all_projects == include_all_projects

        new_project = self.create_project(fire_project_created=True)
        alert_rule = self.create_alert_rule(
            projects=[], include_all_projects=include_all_projects, excluded_projects=[self.project]
        )
        assert alert_rule.query_subscriptions.get().project == new_project
        assert alert_rule.include_all_projects == include_all_projects

    def test_invalid_query(self):
        with self.assertRaises(InvalidSearchQuery):
            create_alert_rule(
                self.organization, [self.project], "hi", "has:", QueryAggregations.TOTAL, 1, 1
            )

    def test_existing_name(self):
        name = "uh oh"
        create_alert_rule(
            self.organization, [self.project], name, "level:error", QueryAggregations.TOTAL, 1, 1
        )
        with self.assertRaises(AlertRuleNameAlreadyUsedError):
            create_alert_rule(
                self.organization,
                [self.project],
                name,
                "level:error",
                QueryAggregations.TOTAL,
                1,
                1,
            )


class UpdateAlertRuleTest(TestCase, BaseIncidentsTest):
    @fixture
    def alert_rule(self):
        return create_alert_rule(
            self.organization,
            [self.project],
            "hello",
            "level:error",
            QueryAggregations.TOTAL,
            10,
            1,
        )

    def test(self):
        name = "uh oh"
        query = "level:warning"
        aggregation = QueryAggregations.UNIQUE_USERS
        time_window = 50
        threshold_period = 2

        updated_projects = [self.project, self.create_project(fire_project_created=True)]

        update_alert_rule(
            self.alert_rule,
            projects=updated_projects,
            name=name,
            query=query,
            aggregation=aggregation,
            time_window=time_window,
            threshold_period=threshold_period,
        )
        assert self.alert_rule.name == name
        updated_subscriptions = self.alert_rule.query_subscriptions.all()
        assert set([sub.project for sub in updated_subscriptions]) == set(updated_projects)
        for subscription in updated_subscriptions:
            assert subscription.query == query
            assert subscription.aggregation == aggregation.value
            assert subscription.time_window == time_window
        assert self.alert_rule.query == query
        assert self.alert_rule.aggregation == aggregation.value
        assert self.alert_rule.time_window == time_window
        assert self.alert_rule.threshold_period == threshold_period

    def test_update_subscription(self):
        old_subscription_id = self.alert_rule.query_subscriptions.get().subscription_id
        update_alert_rule(self.alert_rule, query="some new query")
        assert old_subscription_id != self.alert_rule.query_subscriptions.get().subscription_id

    def test_empty_query(self):
        alert_rule = update_alert_rule(self.alert_rule, query="")
        assert alert_rule.query == ""

    def test_name_used(self):
        used_name = "uh oh"
        create_alert_rule(
            self.organization,
            [self.project],
            used_name,
            "level:error",
            QueryAggregations.TOTAL,
            10,
            1,
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
            QueryAggregations.TOTAL,
            10,
            1,
        )
        update_alert_rule(alert_rule, [self.project])
        assert self.alert_rule.query_subscriptions.get().project == self.project

    def test_new_updated_deleted_projects(self):
        alert_rule = create_alert_rule(
            self.organization,
            [self.project, self.create_project(fire_project_created=True)],
            "something",
            "level:error",
            QueryAggregations.TOTAL,
            10,
            1,
        )
        query_update = "level:warning"
        new_project = self.create_project(fire_project_created=True)
        updated_projects = [self.project, new_project]
        update_alert_rule(alert_rule, updated_projects, query=query_update)
        updated_subscriptions = alert_rule.query_subscriptions.all()
        assert set([sub.project for sub in updated_subscriptions]) == set(updated_projects)
        for sub in updated_subscriptions:
            assert sub.query == query_update

    def test_update_to_include_all(self):
        orig_project = self.project
        alert_rule = self.create_alert_rule(projects=[orig_project])
        new_project = self.create_project(fire_project_created=True)
        assert not QuerySubscription.objects.filter(
            project=new_project, alert_rules=alert_rule
        ).exists()
        update_alert_rule(alert_rule, include_all_projects=True)
        assert set(
            [sub.project for sub in QuerySubscription.objects.filter(alert_rules=alert_rule)]
        ) == set([new_project, orig_project])

    def test_update_to_include_all_with_exclude(self):
        orig_project = self.project
        alert_rule = self.create_alert_rule(projects=[orig_project])
        new_project = self.create_project(fire_project_created=True)
        excluded_project = self.create_project()
        assert not QuerySubscription.objects.filter(
            project=new_project, alert_rules=alert_rule
        ).exists()
        update_alert_rule(
            alert_rule, include_all_projects=True, excluded_projects=[excluded_project]
        )
        assert set(
            [sub.project for sub in QuerySubscription.objects.filter(alert_rules=alert_rule)]
        ) == set([orig_project, new_project])

    def test_update_include_all_exclude_list(self):
        new_project = self.create_project(fire_project_created=True)
        projects = set([new_project, self.project])
        alert_rule = self.create_alert_rule(include_all_projects=True)
        assert (
            set([sub.project for sub in QuerySubscription.objects.filter(alert_rules=alert_rule)])
            == projects
        )
        update_alert_rule(alert_rule, excluded_projects=[self.project])
        assert [
            sub.project for sub in QuerySubscription.objects.filter(alert_rules=alert_rule)
        ] == [new_project]

        update_alert_rule(alert_rule, excluded_projects=[])
        assert (
            set([sub.project for sub in QuerySubscription.objects.filter(alert_rules=alert_rule)])
            == projects
        )

    def test_update_from_include_all(self):
        new_project = self.create_project(fire_project_created=True)
        projects = set([new_project, self.project])
        alert_rule = self.create_alert_rule(include_all_projects=True)
        assert (
            set([sub.project for sub in QuerySubscription.objects.filter(alert_rules=alert_rule)])
            == projects
        )
        update_alert_rule(alert_rule, projects=[new_project], include_all_projects=False)
        assert [
            sub.project for sub in QuerySubscription.objects.filter(alert_rules=alert_rule)
        ] == [new_project]


class DeleteAlertRuleTest(TestCase, BaseIncidentsTest):
    @fixture
    def alert_rule(self):
        return create_alert_rule(
            self.organization,
            [self.project],
            "hello",
            "level:error",
            QueryAggregations.TOTAL,
            10,
            1,
        )

    def test(self):
        alert_rule_id = self.alert_rule.id
        with self.tasks():
            delete_alert_rule(self.alert_rule)

        assert not AlertRule.objects_with_deleted.filter(id=alert_rule_id).exists()

    def test_with_incident(self):
        incident = self.create_incident()
        incident.update(alert_rule=self.alert_rule)
        alert_rule_id = self.alert_rule.id
        with self.tasks():
            delete_alert_rule(self.alert_rule)

        assert not AlertRule.objects_with_deleted.filter(id=alert_rule_id).exists()
        incident = Incident.objects.get(id=incident.id)
        assert Incident.objects.filter(id=incident.id, alert_rule_id__isnull=True).exists()


@freeze_time()
class CalculateIncidentStartTest(TestCase, BaseIncidentsTest):
    def test_empty(self):
        assert timezone.now() == calculate_incident_start("", [self.project], [])

    def test_single_event(self):
        start = self.now - timedelta(minutes=2)
        event = self.create_event(start)
        assert start == calculate_incident_start("", [self.project], [event.group])

    def test_single_spike(self):
        fingerprint = "hello"
        start = self.now - (INCIDENT_START_ROLLUP * 2)
        for _ in range(3):
            event = self.create_event(start, fingerprint=fingerprint)

        end = self.now - INCIDENT_START_ROLLUP
        for _ in range(4):
            event = self.create_event(end, fingerprint=fingerprint)
        assert start + ((end - start) / 3) == calculate_incident_start(
            "", [self.project], [event.group]
        )

    def test_multiple_same_size_spikes(self):
        # The most recent spike should take precedence
        fingerprint = "hello"
        older_spike = self.now - (INCIDENT_START_ROLLUP * 3)
        for _ in range(3):
            event = self.create_event(older_spike, fingerprint=fingerprint)

        newer_spike = self.now - INCIDENT_START_ROLLUP
        for _ in range(3):
            event = self.create_event(newer_spike, fingerprint=fingerprint)
        assert newer_spike == calculate_incident_start("", [self.project], [event.group])

    def test_multiple_spikes_large_older(self):
        # The older spike should take precedence because it's much larger
        fingerprint = "hello"
        older_spike = self.now - (INCIDENT_START_ROLLUP * 2)
        for _ in range(4):
            event = self.create_event(older_spike, fingerprint=fingerprint)

        newer_spike = self.now - INCIDENT_START_ROLLUP
        for _ in range(2):
            event = self.create_event(newer_spike, fingerprint=fingerprint)
        assert older_spike == calculate_incident_start("", [self.project], [event.group])

    def test_multiple_spikes_large_much_older(self):
        # The most recent spike should take precedence because even though the
        # older spike is larger, it's much older.
        fingerprint = "hello"
        older_spike = self.now - (INCIDENT_START_ROLLUP * 1000)
        for _ in range(3):
            event = self.create_event(older_spike, fingerprint=fingerprint)

        newer_spike = self.now - INCIDENT_START_ROLLUP
        for _ in range(2):
            event = self.create_event(newer_spike, fingerprint=fingerprint)
        assert newer_spike == calculate_incident_start("", [self.project], [event.group])


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
        target_display = "hello"
        action = create_alert_rule_trigger_action(
            self.trigger,
            type,
            target_type,
            target_identifier=target_identifier,
            target_display=target_display,
        )
        assert action.alert_rule_trigger == self.trigger
        assert action.type == type.value
        assert action.target_type == target_type.value
        assert action.target_identifier == target_identifier
        assert action.target_display == target_display


class UpdateAlertRuleTriggerAction(BaseAlertRuleTriggerActionTest, TestCase):
    @fixture
    def action(self):
        return create_alert_rule_trigger_action(
            self.trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            target_identifier=six.text_type(self.user.id),
            target_display="hello",
        )

    def test(self):
        type = AlertRuleTriggerAction.Type.SLACK
        target_type = AlertRuleTriggerAction.TargetType.SPECIFIC
        target_identifier = "#ruhroh"
        target_display = "Alert Channel"
        update_alert_rule_trigger_action(
            self.action,
            type=type,
            target_type=target_type,
            target_identifier=target_identifier,
            target_display=target_display,
        )
        assert self.action.type == type.value
        assert self.action.target_type == target_type.value
        assert self.action.target_identifier == target_identifier
        assert self.action.target_display == target_display


class DeleteAlertRuleTriggerAction(BaseAlertRuleTriggerActionTest, TestCase):
    @fixture
    def action(self):
        return create_alert_rule_trigger_action(
            self.trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            target_identifier=six.text_type(self.user.id),
            target_display="hello",
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
            target_display="hello",
        )
        assert list(get_actions_for_trigger(self.trigger)) == [action]
