from __future__ import absolute_import

from exam import patcher
from freezegun import freeze_time

from datetime import timedelta
from uuid import uuid4

import six
from django.utils import timezone
from django.utils.functional import cached_property

from sentry.incidents.logic import (
    create_event_stat_snapshot,
    create_incident,
    create_incident_activity,
    create_initial_event_stats_snapshot,
    get_incident_aggregates,
    get_incident_event_stats,
    get_incident_subscribers,
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
    IncidentType,
)
from sentry.models.repository import Repository
from sentry.testutils import (
    TestCase,
    SnubaTestCase,
)


class CreateIncidentTest(TestCase):
    def test_simple(self):
        incident_type = IncidentType.CREATED
        title = 'hello'
        query = 'goodbye'
        date_started = timezone.now()
        other_project = self.create_project()
        other_group = self.create_group(project=other_project)
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


@freeze_time()
class UpdateIncidentStatus(TestCase):
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


class GetIncidentEventStatsTest(TestCase, BaseIncidentsTest):

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
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=1))

        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[self.project]
        )
        self.run_test(incident, [2, 1])
        self.run_test(incident, [1], start=self.now - timedelta(minutes=1))
        self.run_test(incident, [2], end=self.now - timedelta(minutes=1, seconds=59))

    def test_groups(self):
        fingerprint = 'group-1'
        event = self.create_event(self.now - timedelta(minutes=2), fingerprint=fingerprint)
        self.create_event(self.now - timedelta(minutes=2), fingerprint='other-group')
        self.create_event(self.now - timedelta(minutes=1), fingerprint=fingerprint)

        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[],
            groups=[event.group],
        )
        self.run_test(incident, [1, 1])


class GetIncidentAggregatesTest(TestCase, BaseIncidentsTest):
    def test_projects(self):
        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[self.project]
        )
        self.create_event(self.now - timedelta(minutes=1))
        self.create_event(self.now - timedelta(minutes=2), user={'id': 123})
        self.create_event(self.now - timedelta(minutes=2), user={'id': 123})
        self.create_event(self.now - timedelta(minutes=2), user={'id': 124})
        assert get_incident_aggregates(incident) == {'count': 4, 'unique_users': 2}

    def test_groups(self):
        fp = 'group'
        group = self.create_event(self.now - timedelta(minutes=1), fingerprint=fp).group
        self.create_event(self.now - timedelta(minutes=2), user={'id': 123}, fingerprint=fp)
        self.create_event(self.now - timedelta(minutes=2), user={'id': 123}, fingerprint=fp)
        self.create_event(self.now - timedelta(minutes=2), user={'id': 123}, fingerprint='other')
        self.create_event(self.now - timedelta(minutes=2), user={'id': 124}, fingerprint=fp)
        self.create_event(self.now - timedelta(minutes=2), user={'id': 124}, fingerprint='other')

        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[],
            groups=[group],
        )
        assert get_incident_aggregates(incident) == {'count': 4, 'unique_users': 2}


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

    def assert_notifications_sent(self, activity):
        self.send_subscriber_notifications.apply_async.assert_called_once_with(
            kwargs={'activity_id': activity.id},
            countdown=10,
        )

    def test_no_snapshot(self):
        incident = self.create_incident()
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

    def test_mentioned_user_ids(self):
        incident = self.create_incident()
        mentioned_member = self.create_user()
        comment = 'hello **@%s**' % mentioned_member.username
        with self.assertChanges(
            lambda: IncidentSubscription.objects.filter(
                incident=incident,
                user=mentioned_member,
            ).exists(),
            before=False,
            after=True,
        ):
            activity = create_incident_activity(
                incident,
                IncidentActivityType.COMMENT,
                user=self.user,
                comment=comment,
                mentioned_user_ids=[mentioned_member.id],
            )
        assert activity.incident == incident
        assert activity.type == IncidentActivityType.COMMENT.value
        assert activity.user == self.user
        assert activity.comment == comment
        assert activity.value is None
        assert activity.previous_value is None
        self.assert_notifications_sent(activity)


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
        release = self.create_release(
            project=self.project,
            version='v12'
        )

        included_commits = set([letter * 40 for letter in ('a', 'b', 'c', 'd')])
        commit_iter = iter(included_commits)

        event = self.store_event(
            data={
                'fingerprint': ['group-1'],
                'message': 'Kaboom!',
                'platform': 'python',
                'stacktrace': {
                    'frames': [
                        {
                            "function": "handle_set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                            "module": "sentry.tasks",
                            "in_app": True,
                            "lineno": 30,
                            "filename": "sentry/tasks.py",
                        },
                        {
                            "function": "set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                            "module": "sentry.models.release",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/release.py",
                        }
                    ]
                },
                'release': release.version,
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
                'patch_set': [
                    {
                        'path': 'src/sentry/models/release.py',
                        'type': 'M',
                    },
                ]
            },
            {
                'id': next(commit_iter),
                'repository': self.repo.name,
                'author_email': 'bob@example.com',
                'author_name': 'Bob',
                'message': 'i fixed a bug',
                'patch_set': [
                    {
                        'path': 'src/sentry/models/release.py',
                        'type': 'M',
                    },
                ]
            },
            {
                'id': next(commit_iter),
                'repository': self.repo.name,
                'author_email': 'ross@example.com',
                'author_name': 'Ross',
                'message': 'i fixed a bug',
                'patch_set': [
                    {
                        'path': 'src/sentry/models/release.py',
                        'type': 'M',
                    },
                ]
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
                        {
                            "function": "handle_set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                            "module": "sentry.tasks",
                            "in_app": True,
                            "lineno": 30,
                            "filename": "sentry/tasks.py",
                        },
                        {
                            "function": "set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/models/group.py",
                            "module": "sentry.models.group",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/group.py",
                        },
                    ],
                },
                'release': release_2.version,
            },
            project_id=self.project.id,
        )
        group_2 = event_2.group
        release_2.set_commits([
            {
                'id': next(commit_iter),
                'repository': self.repo.name,
                'author_email': 'hello@example.com',
                'author_name': 'Hello',
                'message': 'i fixed a bug',
                'patch_set': [
                    {
                        'path': 'src/sentry/models/group.py',
                        'type': 'M',
                    },
                ]
            },
        ])

        excluded_project = self.create_project()
        excluded_event = self.store_event(
            data={
                'fingerprint': ['group-3'],
                'message': 'Kaboom!',
                'platform': 'python',
                'stacktrace': {
                    'frames': [
                        {
                            "function": "set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/models/event.py",
                            "module": "sentry.models.event",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/event.py",
                        },
                    ],
                },
                'release': release_2.version,
            },
            project_id=excluded_project.id,
        )
        excluded_release = self.create_release(project=self.project, version='v9000')

        excluded_commit = 'e' * 40
        excluded_group = excluded_event.group
        excluded_release.set_commits([
            {
                'id': excluded_commit,
                'repository': self.repo.name,
                'author_email': 'hello@example.com',
                'author_name': 'Hello',
                'message': 'i fixed a bug',
                'patch_set': [
                    {
                        'path': 'src/sentry/models/event.py',
                        'type': 'M',
                    },
                ]
            },
        ])

        incident = self.create_incident(
            self.organization,
            groups=[group, group_2, excluded_group],
        )

        assert set(suspect['id'] for suspect in get_incident_suspects(
            incident,
            incident.projects.exclude(id=excluded_project.id),
        )) == included_commits
