from __future__ import absolute_import

from datetime import timedelta
from freezegun import freeze_time
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
)
from sentry.incidents.models import (
    IncidentActivity,
    IncidentActivityType,
    IncidentGroup,
    IncidentProject,
    IncidentStatus,
)
from sentry.testutils import (
    TestCase,
    SnubaTestCase,
)


class CreateIncidentTest(TestCase):
    def test_simple(self):
        status = IncidentStatus.CREATED
        title = 'hello'
        query = 'goodbye'
        date_started = timezone.now()
        other_project = self.create_project()
        other_group = self.create_group(project=other_project)
        incident = create_incident(
            self.organization,
            status=status,
            title=title,
            query=query,
            date_started=date_started,
            projects=[self.project],
            groups=[self.group, other_group],
        )
        assert incident.identifier == 1
        assert incident.status == status.value
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

    def test_no_snapshot(self):
        incident = self.create_incident()
        activity = create_incident_activity(
            incident,
            IncidentActivityType.STATUS_CHANGE,
            user=self.user,
            value=six.text_type(IncidentStatus.CLOSED.value),
            previous_value=six.text_type(IncidentStatus.CREATED.value),
        )
        assert activity.incident == incident
        assert activity.type == IncidentActivityType.STATUS_CHANGE.value
        assert activity.user == self.user
        assert activity.value == six.text_type(IncidentStatus.CLOSED.value)
        assert activity.previous_value == six.text_type(IncidentStatus.CREATED.value)

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
