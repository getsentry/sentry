from datetime import timedelta

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.incident import DetailedIncidentSerializer
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


class IncidentSerializerTest(TestCase):
    @freeze_time()
    def test_simple(self):
        incident = self.create_incident(date_started=timezone.now() - timedelta(minutes=5))
        result = serialize(incident)

        assert result["id"] == str(incident.id)
        assert result["identifier"] == str(incident.identifier)
        assert result["organizationId"] == str(incident.organization_id)
        assert result["projects"] == [p.slug for p in incident.projects.all()]
        assert result["status"] == incident.status
        assert result["statusMethod"] == incident.status_method
        assert result["type"] == incident.type
        assert result["title"] == incident.title
        assert result["dateStarted"] == incident.date_started
        assert result["dateDetected"] == incident.date_detected
        assert result["dateCreated"] == incident.date_added
        assert result["dateClosed"] == incident.date_closed


class DetailedIncidentSerializerTest(TestCase):
    def test_error_alert_rule(self):
        query = "test query"
        incident = self.create_incident(query=query)

        serializer = DetailedIncidentSerializer()
        result = serialize(incident, serializer=serializer)
        assert result["alertRule"] == serialize(incident.alert_rule)
        assert result["discoverQuery"] == f"(event.type:error) AND ({query})"

    def test_error_alert_rule_unicode(self):
        query = "统一码"
        incident = self.create_incident(query=query)

        serializer = DetailedIncidentSerializer()
        result = serialize(incident, serializer=serializer)
        assert result["alertRule"] == serialize(incident.alert_rule)
        assert result["discoverQuery"] == f"(event.type:error) AND ({query})"

    def test_transaction_alert_rule(self):
        query = "test query"
        alert_rule = self.create_alert_rule(dataset=Dataset.Transactions, query=query)
        incident = self.create_incident(alert_rule=alert_rule)

        serializer = DetailedIncidentSerializer()
        result = serialize(incident, serializer=serializer)
        assert result["alertRule"] == serialize(incident.alert_rule)
        assert result["discoverQuery"] == f"(event.type:transaction) AND ({query})"
