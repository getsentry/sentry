from datetime import datetime, timedelta
from uuid import uuid4

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.incidents.logic import create_incident_activity
from sentry.incidents.models.incident import IncidentActivityType
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time


class IncidentActivitySerializerTest(TestCase, SnubaTestCase):
    def test_simple(self):
        activity = create_incident_activity(
            incident=self.create_incident(),
            activity_type=IncidentActivityType.CREATED,
        )
        result = serialize(activity)

        assert result["id"] == str(activity.id)
        assert result["incidentIdentifier"] == str(activity.incident.identifier)
        assert result["type"] == activity.type
        assert result["value"] is None
        assert result["previousValue"] is None
        assert result["dateCreated"] == activity.date_added

    def test_event_stats(self):
        now = datetime.now()
        with freeze_time((now - timedelta(days=1)).replace(hour=12, minute=30, second=25)):
            for _ in range(2):
                self.store_event(
                    data={
                        "event_id": uuid4().hex,
                        "fingerprint": ["group1"],
                        "timestamp": before_now(seconds=1).isoformat(),
                    },
                    project_id=self.project.id,
                )
            incident = self.create_incident(
                date_started=timezone.now() - timedelta(hours=2), projects=[self.project], query=""
            )
            activity = create_incident_activity(
                incident=incident,
                activity_type=IncidentActivityType.CREATED,
            )
            result = serialize(activity)

            assert result["id"] == str(activity.id)
            assert result["incidentIdentifier"] == str(activity.incident.identifier)
            assert result["type"] == activity.type
            assert result["value"] is None
            assert result["previousValue"] is None
            assert result["dateCreated"] == activity.date_added
