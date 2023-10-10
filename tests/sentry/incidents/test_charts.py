import datetime

from django.utils.dateparse import parse_datetime

from sentry.incidents.charts import incident_date_range
from sentry.incidents.models import Incident
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time

now = "2022-05-16T20:00:00"
frozen_time = f"{now}Z"


def must_parse_datetime(s: str) -> datetime.datetime:
    ret = parse_datetime(s)
    assert ret is not None
    return ret


class IncidentDateRangeTest(TestCase):
    @freeze_time(frozen_time)
    def test_use_current_date_for_active_incident(self):
        incident = Incident(
            date_started=must_parse_datetime("2022-05-16T18:55:00Z"), date_closed=None
        )
        assert incident_date_range(60, incident) == {
            "start": "2022-05-16T17:40:00",
            "end": now,
        }

    @freeze_time(frozen_time)
    def test_use_current_date_for_recently_closed_alert(self):
        incident = Incident(
            date_started=must_parse_datetime("2022-05-16T18:55:00Z"),
            date_closed=must_parse_datetime("2022-05-16T18:57:00Z"),
        )
        assert incident_date_range(60, incident) == {
            "start": "2022-05-16T17:40:00",
            "end": now,
        }

    @freeze_time(frozen_time)
    def test_use_a_past_date_for_an_older_alert(self):
        #  Incident is from over a week ago
        incident = Incident(
            date_started=must_parse_datetime("2022-05-04T18:55:00Z"),
            date_closed=must_parse_datetime("2022-05-04T18:57:00Z"),
        )
        assert incident_date_range(60, incident) == {
            "start": "2022-05-04T17:40:00",
            "end": "2022-05-04T20:12:00",
        }

    @freeze_time(frozen_time)
    def test_large_time_windows(self):
        incident = Incident(
            date_started=must_parse_datetime("2022-04-20T20:28:00Z"),
            date_closed=None,
        )
        one_day = 1440 * 60
        assert incident_date_range(one_day, incident) == {
            "start": "2022-02-04T20:28:00",
            "end": now,
        }
