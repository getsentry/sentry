from datetime import datetime, timedelta
from uuid import uuid4

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.incidents.logic import create_incident_activity
from sentry.incidents.models import IncidentActivityType
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test
class IncidentActivitySerializerTest(TestCase, SnubaTestCase):
    def test_simple(self):
        activity = create_incident_activity(
            incident=self.create_incident(),
            activity_type=IncidentActivityType.COMMENT,
            user=self.user,
            comment="hello",
        )
        result = serialize(activity)

        assert result["id"] == str(activity.id)
        assert result["incidentIdentifier"] == str(activity.incident.identifier)
        assert (
            result["user"]
            == user_service.serialize_many(filter=dict(user_ids=[activity.user_id]))[0]
        )
        assert result["type"] == activity.type
        assert result["value"] is None
        assert result["previousValue"] is None
        assert result["comment"] == activity.comment
        assert result["dateCreated"] == activity.date_added

    def test_no_user(self):
        activity = create_incident_activity(
            incident=self.create_incident(),
            activity_type=IncidentActivityType.COMMENT,
            user=None,
            comment="hello",
        )
        result = serialize(activity)

        assert result["id"] == str(activity.id)
        assert result["incidentIdentifier"] == str(activity.incident.identifier)
        assert result["user"] is None
        assert result["type"] == activity.type
        assert result["value"] is None
        assert result["previousValue"] is None
        assert result["comment"] == activity.comment
        assert result["dateCreated"] == activity.date_added

    def test_event_stats(self):
        now = datetime.now()
        with freeze_time((now - timedelta(days=1)).replace(hour=12, minute=30, second=25)):
            for _ in range(2):
                self.store_event(
                    data={
                        "event_id": uuid4().hex,
                        "fingerprint": ["group1"],
                        "timestamp": iso_format(before_now(seconds=1)),
                    },
                    project_id=self.project.id,
                )
            incident = self.create_incident(
                date_started=timezone.now() - timedelta(hours=2), projects=[self.project], query=""
            )
            activity = create_incident_activity(
                incident=incident,
                activity_type=IncidentActivityType.COMMENT,
                user=self.user,
                comment="hello",
            )
            result = serialize(activity)

            assert result["id"] == str(activity.id)
            assert result["incidentIdentifier"] == str(activity.incident.identifier)
            assert (
                result["user"]
                == user_service.serialize_many(filter=dict(user_ids=[activity.user_id]))[0]
            )
            assert result["type"] == activity.type
            assert result["value"] is None
            assert result["previousValue"] is None
            assert result["comment"] == activity.comment
            assert result["dateCreated"] == activity.date_added
