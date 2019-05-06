from __future__ import absolute_import

from datetime import timedelta
from uuid import uuid4

from django.utils import timezone
from django.utils.functional import cached_property

from sentry.incidents.logic import (
    create_incident,
    get_incident_aggregates,
    get_incident_event_stats,
)
from sentry.incidents.models import (
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
    def test_project(self):
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=2))
        self.create_event(self.now - timedelta(minutes=1))

        incident = self.create_incident(
            date_started=self.now - timedelta(minutes=5),
            query='',
            projects=[self.project]
        )
        result = get_incident_event_stats(incident)
        # Duration of 300s / 20 data points
        assert result.rollup == 15
        assert result.start == incident.date_started
        assert result.end == incident.current_end_date
        assert len(result.data['data']) == 2
        assert result.data['data'][0]['count'] == 2
        assert result.data['data'][1]['count'] == 1

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
        result = get_incident_event_stats(incident)
        # Duration of 300s / 20 data points
        assert result.rollup == 15
        assert result.start == incident.date_started
        assert result.end == incident.current_end_date
        assert len(result.data['data']) == 2, result.data
        assert result.data['data'][0]['count'] == 1
        assert result.data['data'][1]['count'] == 1


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
