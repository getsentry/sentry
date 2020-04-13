# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta

import six
from django.utils import timezone
from freezegun import freeze_time

from sentry.api.serializers import serialize
from sentry.api.serializers.models.incident import DetailedIncidentSerializer
from sentry.incidents.logic import create_alert_rule, subscribe_to_incident
from sentry.incidents.models import IncidentGroup
from sentry.snuba.models import QueryAggregations
from sentry.testutils import TestCase


class IncidentSerializerTest(TestCase):
    @freeze_time()
    def test_simple(self):
        incident = self.create_incident(date_started=timezone.now() - timedelta(minutes=5))
        result = serialize(incident)

        assert result["id"] == six.text_type(incident.id)
        assert result["identifier"] == six.text_type(incident.identifier)
        assert result["organizationId"] == six.text_type(incident.organization_id)
        assert result["projects"] == [p.slug for p in incident.projects.all()]
        assert result["status"] == incident.status
        assert result["type"] == incident.type
        assert result["title"] == incident.title
        assert result["query"] == incident.query
        assert result["aggregation"] == incident.aggregation
        assert result["dateStarted"] == incident.date_started
        assert result["dateDetected"] == incident.date_detected
        assert result["dateCreated"] == incident.date_added
        assert result["dateClosed"] == incident.date_closed


class DetailedIncidentSerializerTest(TestCase):
    def test_subscribed(self):
        incident = self.create_incident(date_started=timezone.now() - timedelta(minutes=5))
        serializer = DetailedIncidentSerializer()
        result = serialize(incident, serializer=serializer, user=self.user)
        assert not result["isSubscribed"]
        subscribe_to_incident(incident, self.user)
        result = serialize(incident, serializer=serializer, user=self.user)
        assert result["isSubscribed"]

    def test_groups(self):
        incident = self.create_incident()
        serializer = DetailedIncidentSerializer()
        result = serialize(incident, serializer=serializer)
        assert result["groups"] == []
        IncidentGroup.objects.create(incident=incident, group=self.group)
        result = serialize(incident, serializer=serializer)
        assert result["groups"] == [six.text_type(self.group.id)]

    def test_no_alert_rule(self):
        incident = self.create_incident()
        serializer = DetailedIncidentSerializer()
        result = serialize(incident, serializer=serializer)
        assert result["alertRule"] is None
        assert result["discoverQuery"] == incident.query

    def test_alert_rule(self):
        incident = self.create_incident()
        query = "test query"
        alert_rule = create_alert_rule(
            self.organization, [self.project], "hi", "test query", QueryAggregations.TOTAL, 10, 1
        )
        incident.update(alert_rule=alert_rule)

        serializer = DetailedIncidentSerializer()
        result = serialize(incident, serializer=serializer)
        assert result["alertRule"] == serialize(alert_rule)
        assert result["discoverQuery"] == "event.type:error {}".format(query)
