from __future__ import absolute_import

from datetime import timedelta
from exam import (
    fixture,
    patcher,
)
from freezegun import freeze_time

from uuid import uuid4

import six
from django.utils import timezone
from django.utils.functional import cached_property

from sentry.incidents.events import (
    IncidentCommentCreatedEvent,
    IncidentCreatedEvent,
    IncidentStatusUpdatedEvent,
)
from sentry.incidents.logic import (
    create_event_stat_snapshot,
    create_incident,
    create_incident_activity,
    create_initial_event_stats_snapshot,
    bulk_build_incident_query_params,
    bulk_get_incident_aggregates,
    bulk_get_incident_event_stats,
    get_incident_aggregates,
    get_incident_event_stats,
    get_incident_subscribers,
    get_incident_suspect_commits,
    get_incident_suspects,
    subscribe_to_incident,
    StatusAlreadyChangedError,
    update_incident_status,
)
from sentry.incidents.models import (
    Incident,
    IncidentActivity,
    IncidentActivityType,
    IncidentGroup,
    IncidentProject,
    IncidentStatus,
    IncidentSubscription,
    IncidentSuspectCommit,
    IncidentType,
)
from sentry.models.commit import Commit
from sentry.models.repository import Repository
from sentry.testutils import (
    TestCase,
    SnubaTestCase,
)


class CreateIncidentTest(TestCase):
    record_event = patcher('sentry.analytics.base.Analytics.record_event')
    calculate_incident_suspects = patcher('sentry.incidents.logic.calculate_incident_suspects')

    def test_simple(self):
        incident_type = IncidentType.CREATED
        title = 'hello'
        query = 'goodbye'
        date_started = timezone.now()
        other_project = self.create_project()
        other_group = self.create_group(project=other_project)
        self.record_event.reset_mock()
        incident = create_incident(
            self.organization,
            type=incident_type,
            title=title,
            query=query,
            date_started=date_started,
            projects=[self.project],
            groups=[self.group, other_group],
        )
        assert incident.identifier == 1
        assert incident.status == incident_type.value
        assert incident.title == title
        assert incident.query == query
        assert incident.date_started == date_started
        assert incident.date_detected == date_started
        assert IncidentGroup.objects.filter(
            incident=incident,
            group__in=[self.group, other_group]
        ).count() == 2
        assert IncidentProject.objects.filter(
            incident=incident,
            project__in=[self.project, other_project],
        ).count() == 2
        assert IncidentActivity.objects.filter(
            incident=incident,
            type=IncidentActivityType.CREATED.value,
            event_stats_snapshot__isnull=False,
        ).count() == 1
        assert len(self.record_event.call_args_list) == 1
        event = self.record_event.call_args[0][0]
        assert isinstance(event, IncidentCreatedEvent)
        assert event.data == {
            'organization_id': six.text_type(self.organization.id),
            'incident_id': six.text_type(incident.id),
            'incident_type': six.text_type(IncidentType.CREATED.value),
        }
        self.calculate_incident_suspects.apply_async.assert_called_once_with(
            kwargs={'incident_id': incident.id},
        )


@freeze_time()
class UpdateIncidentStatus(TestCase):
    record_event = patcher('sentry.analytics.base.Analytics.record_event')

    def get_most_recent_incident_activity(self, incident):
        return IncidentActivity.objects.filter(incident=incident).order_by('-id')[:1].get()

    def test_status_already_set(self):
        incident = self.create_incident(status=IncidentStatus.OPEN.value)
        with self.assertRaises(StatusAlreadyChangedError):
            update_incident_status(incident, IncidentStatus.OPEN)

    def run_test(
        self,
        incident,
        status,
        expected_date_closed,
        user=None,
        comment=None,
    ):
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
            'organization_id': six.text_type(self.organization.id),
            'incident_id': six.text_type(incident.id),
            'incident_type': six.text_type(incident.type),
            'prev_status': six.text_type(prev_status),
            'status': six.text_type(incident.status),
        }

    def test_closed(self):
        incident = self.create_incident()
        self.run_test(incident, IncidentStatus.CLOSED, timezone.now())

    def test_reopened(self):
        incident = self.create_incident(
            status=IncidentStatus.CLOSED.value,
            date_closed=timezone.now()
        )
        self.run_test(incident, IncidentStatus.OPEN, None)

    def test_all_params(self):
        incident = self.create_incident()
        self.run_test(
            incident,
            IncidentStatus.CLOSED,
            timezone.now(),
            user=self.user,
            comment='lol',
        )


class BaseIncidentsTest(SnubaTestCase):
    def create_event(self, timestamp, fingerprint=None, user=None):
        event_id = uuid4().hex
        if fingerprint is None:
            fingerprint = event_id

        data = {
            'event_id': event_id,
            'fingerprint': [fingerprint],
            'timestamp': timestamp.isoformat()[:19]
        }
        if user:
            data['user'] = user
        return self.store_event(data=data, project_id=self.project.id)

    @cached_property
    def now(self):
        return timezone.now()


class BaseIncidentEventStatsTest(BaseIncidentsTest):
    @fixture
    def project_incident(self):
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=1))
        return self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[self.project]
        )

    @fixture
    def group_incident(self):
        fingerprint = 'group-1'
        event = self.create_event(self.now - timedelta(minutes=2), fingerprint=fingerprint)
        self.create_event(self.now - timedelta(minutes=2), fingerprint='other-group')
        self.create_event(self.now - timedelta(minutes=1), fingerprint=fingerprint)
        return self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[],
            groups=[event.group],
        )


class GetIncidentEventStatsTest(TestCase, BaseIncidentEventStatsTest):

    def run_test(self, incident, expected_results, start=None, end=None):
        kwargs = {}
        if start is not None:
            kwargs['start'] = start
        if end is not None:
            kwargs['end'] = end

        result = get_incident_event_stats(incident, data_points=20, **kwargs)
        # Duration of 300s / 20 data points
        assert result.rollup == 15
        assert result.start == start if start else incident.date_started
        assert result.end == end if end else incident.current_end_date
        assert [r['count'] for r in result.data['data']] == expected_results

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
            assert [r['count'] for r in result.data['data']] == expected_results

    def test_project(self):
        other_project = self.create_project()
        other_incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query='',
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
            query='',
            projects=[],
            groups=[other_group],
        )

        self.run_test([self.group_incident, other_incident], [[1, 1], []])


class BaseIncidentAggregatesTest(BaseIncidentsTest):
    @property
    def project_incident(self):
        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[self.project]
        )
        self.create_event(self.now - timedelta(minutes=1))
        self.create_event(self.now - timedelta(minutes=2), user={'id': 123})
        self.create_event(self.now - timedelta(minutes=2), user={'id': 123})
        self.create_event(self.now - timedelta(minutes=2), user={'id': 124})
        return incident

    @property
    def group_incident(self):
        fp = 'group'
        group = self.create_event(self.now - timedelta(minutes=1), fingerprint=fp).group
        self.create_event(self.now - timedelta(minutes=2), user={'id': 123}, fingerprint=fp)
        self.create_event(self.now - timedelta(minutes=2), user={'id': 123}, fingerprint=fp)
        self.create_event(self.now - timedelta(minutes=2), user={'id': 123}, fingerprint='other')
        self.create_event(self.now - timedelta(minutes=2), user={'id': 124}, fingerprint=fp)
        self.create_event(self.now - timedelta(minutes=2), user={'id': 124}, fingerprint='other')
        return self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[],
            groups=[group],
        )


class GetIncidentAggregatesTest(TestCase, BaseIncidentAggregatesTest):

    def test_projects(self):
        assert get_incident_aggregates(self.project_incident) == {'count': 4, 'unique_users': 2}

    def test_groups(self):
        assert get_incident_aggregates(self.group_incident) == {'count': 4, 'unique_users': 2}


class BulkGetIncidentAggregatesTest(TestCase, BaseIncidentAggregatesTest):
    def test_projects(self):
        other_project = self.create_project()
        other_incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[other_project],
            groups=[],
        )
        params = bulk_build_incident_query_params([self.project_incident, other_incident])

        assert bulk_get_incident_aggregates(params) == [
            {'count': 4, 'unique_users': 2},
            {'count': 0, 'unique_users': 0},
        ]

    def test_groups(self):
        other_group = self.create_group()
        other_incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[],
            groups=[other_group],
        )

        params = bulk_build_incident_query_params([self.group_incident, other_incident])
        assert bulk_get_incident_aggregates(params) == [
            {'count': 4, 'unique_users': 2},
            {'count': 0, 'unique_users': 0},
        ]


@freeze_time()
class CreateEventStatTest(TestCase, BaseIncidentsTest):

    def test_simple(self):
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=1))
        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[self.project]
        )
        snapshot = create_event_stat_snapshot(
            incident,
            incident.date_started,
            incident.current_end_date,
        )
        assert snapshot.start == incident.date_started
        assert snapshot.end == incident.current_end_date
        assert [row[1] for row in snapshot.values] == [2, 1]


@freeze_time()
class CreateIncidentActivityTest(TestCase, BaseIncidentsTest):
    send_subscriber_notifications = patcher('sentry.incidents.logic.send_subscriber_notifications')
    record_event = patcher('sentry.analytics.base.Analytics.record_event')

    def assert_notifications_sent(self, activity):
        self.send_subscriber_notifications.apply_async.assert_called_once_with(
            kwargs={'activity_id': activity.id},
            countdown=10,
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
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[self.project]
        )
        event_stats_snapshot = create_initial_event_stats_snapshot(incident)
        self.record_event.reset_mock()
        activity = create_incident_activity(
            incident,
            IncidentActivityType.CREATED,
            event_stats_snapshot=event_stats_snapshot,
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
        comment = 'hello'
        with self.assertChanges(
            lambda: IncidentSubscription.objects.filter(
                incident=incident,
                user=self.user,
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
            'organization_id': six.text_type(self.organization.id),
            'incident_id': six.text_type(incident.id),
            'incident_type': six.text_type(incident.type),
            'user_id': six.text_type(self.user.id),
            'activity_id': six.text_type(activity.id),
        }

    def test_mentioned_user_ids(self):
        incident = self.create_incident()
        mentioned_member = self.create_user()
        subscribed_mentioned_member = self.create_user()
        IncidentSubscription.objects.create(incident=incident, user=subscribed_mentioned_member)
        comment = 'hello **@%s** and **@%s**' % (
            mentioned_member.username,
            subscribed_mentioned_member.username,
        )
        with self.assertChanges(
            lambda: IncidentSubscription.objects.filter(
                incident=incident,
                user=mentioned_member,
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
            'organization_id': six.text_type(self.organization.id),
            'incident_id': six.text_type(incident.id),
            'incident_type': six.text_type(incident.type),
            'user_id': six.text_type(self.user.id),
            'activity_id': six.text_type(activity.id),
        }


@freeze_time()
class CreateInitialEventStatsSnapshotTest(TestCase, BaseIncidentsTest):

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
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[self.project]
        )
        event_stat_snapshot = create_initial_event_stats_snapshot(incident)
        assert event_stat_snapshot.start == self.now - timedelta(minutes=40)
        assert [row[1] for row in event_stat_snapshot.values] == [1, 1, 2, 1]


class GetIncidentSuscribersTest(TestCase, BaseIncidentsTest):

    def test_simple(self):
        incident = self.create_incident()
        assert list(get_incident_subscribers(incident)) == []
        subscription = subscribe_to_incident(incident, self.user)[0]
        assert list(get_incident_subscribers(incident)) == [subscription]


class GetIncidentSuspectsTest(TestCase, BaseIncidentsTest):

    def test_simple(self):
        release = self.create_release(project=self.project, version='v12')

        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name=self.organization.id,
        )
        commit_id = 'a' * 40
        release.set_commits([
            {
                'id': commit_id,
                'repository': self.repo.name,
                'author_email': 'bob@example.com',
                'author_name': 'Bob',
            },
        ])
        incident = self.create_incident(self.organization)
        commit = Commit.objects.get(releasecommit__release=release)
        IncidentSuspectCommit.objects.create(incident=incident, commit=commit, order=1)
        assert [commit] == list(get_incident_suspects(incident, [self.project]))
        assert [] == list(get_incident_suspects(incident, []))


class GetIncidentSuspectCommitsTest(TestCase, BaseIncidentsTest):
    def test_simple(self):
        release = self.create_release(
            project=self.project,
            version='v12'
        )

        included_commits = set([letter * 40 for letter in ('a', 'b', 'c', 'd')])
        commit_iter = iter(included_commits)

        one_min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        event = self.store_event(
            data={
                'fingerprint': ['group-1'],
                'message': 'Kaboom!',
                'platform': 'python',
                'stacktrace': {
                    'frames': [
                        {'filename': 'sentry/tasks.py'},
                        {'filename': 'sentry/models/release.py'},
                    ]
                },
                'release': release.version,
                'timestamp': one_min_ago,
            },
            project_id=self.project.id,
        )
        group = event.group
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name=self.organization.id,
        )
        release.set_commits([
            {
                'id': next(commit_iter),
                'repository': self.repo.name,
                'author_email': 'bob@example.com',
                'author_name': 'Bob',
                'message': 'i fixed a bug',
                'patch_set': [{'path': 'src/sentry/models/release.py', 'type': 'M'}]
            },
            {
                'id': next(commit_iter),
                'repository': self.repo.name,
                'author_email': 'bob@example.com',
                'author_name': 'Bob',
                'message': 'i fixed a bug',
                'patch_set': [{'path': 'src/sentry/models/release.py', 'type': 'M'}]
            },
            {
                'id': next(commit_iter),
                'repository': self.repo.name,
                'author_email': 'ross@example.com',
                'author_name': 'Ross',
                'message': 'i fixed a bug',
                'patch_set': [{'path': 'src/sentry/models/release.py', 'type': 'M'}]
            },
        ])
        release_2 = self.create_release(project=self.project, version='v13')
        event_2 = self.store_event(
            data={
                'fingerprint': ['group-2'],
                'message': 'Kaboom!',
                'platform': 'python',
                'stacktrace': {
                    'frames': [
                        {'filename': 'sentry/tasks.py'},
                        {'filename': 'sentry/models/group.py'},
                    ],
                },
                'release': release_2.version,
                'timestamp': one_min_ago,
            },
            project_id=self.project.id,
        )
        group_2 = event_2.group
        excluded_id = 'z' * 40
        release_2.set_commits([
            {
                'id': next(commit_iter),
                'repository': self.repo.name,
                'author_email': 'hello@example.com',
                'author_name': 'Hello',
                'message': 'i fixed a bug',
                'patch_set': [{'path': 'src/sentry/models/group.py', 'type': 'M'}]
            },
            {
                'id': excluded_id,
                'repository': self.repo.name,
                'author_email': 'hello@example.com',
                'author_name': 'Hello',
                'message': 'i fixed a bug',
                'patch_set': [{'path': 'src/sentry/models/not_group.py', 'type': 'M'}]
            },

        ])

        commit_ids = Commit.objects.filter(
            releasecommit__release__in=[release, release_2],
        ).exclude(key=excluded_id).values_list('id', flat=True)
        incident = self.create_incident(
            self.organization,
            groups=[group, group_2],
        )
        assert set(get_incident_suspect_commits(incident)) == set(commit_ids)
