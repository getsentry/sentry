from django.utils.dateparse import parse_datetime
from freezegun import freeze_time

from sentry.incidents.charts import incident_date_range
from sentry.incidents.models import Incident
from sentry.testutils import TestCase


class IncidentDateRangeTest(TestCase):
    @freeze_time("2022-05-16T20:00:00Z")
    def test_incident_date_range(self):
        incident = Incident(date_closed=None, date_started=parse_datetime("2022-05-16T18:55:00Z"))
        assert incident_date_range(60, incident) == {
            "start": "2022-05-13T15:55:00",
            "end": "2022-05-16T20:00:00",
        }
