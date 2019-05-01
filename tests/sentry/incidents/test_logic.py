from __future__ import absolute_import

from django.utils import timezone

from sentry.incidents.logic import create_incident
from sentry.incidents.models import (
    IncidentGroup,
    IncidentProject,
    IncidentStatus,
)
from sentry.testutils import TestCase


class CreateIncidentTest(TestCase):
    def test_simple(self):
        status = IncidentStatus.CREATED
        title = 'hello'
        query = 'goodbye'
        date_started = timezone.now()
        incident = create_incident(
            self.organization,
            status=status,
            title=title,
            query=query,
            date_started=date_started,
            projects=[self.project],
            groups=[self.group],
        )
        assert incident.identifier == 1
        assert incident.status == status.value
        assert incident.title == title
        assert incident.query == query
        assert incident.date_started == date_started
        assert incident.date_detected == date_started
        assert IncidentGroup.objects.filter(incident=incident, group=self.group).exists()
        assert IncidentProject.objects.filter(incident=incident, project=self.project).exists()
