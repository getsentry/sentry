# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta

import six
from django.utils import timezone
from freezegun import freeze_time

from sentry.api.serializers import serialize
from sentry.api.serializers.models.incident import DetailedIncidentSerializer
from sentry.incidents.logic import subscribe_to_incident
from sentry.incidents.models import IncidentGroup
from sentry.testutils import TestCase


class IncidentSerializerTest(TestCase):
    @freeze_time()
    def test_simple(self):
        incident = self.create_incident(date_started=timezone.now() - timedelta(minutes=5))
        result = serialize(incident)

        assert result['id'] == six.text_type(incident.id)
        assert result['identifier'] == six.text_type(incident.identifier)
        assert result['organizationId'] == six.text_type(incident.organization_id)
        assert result['projects'] == [p.slug for p in incident.projects.all()]
        assert result['status'] == incident.status
        assert result['type'] == incident.type
        assert result['title'] == incident.title
        assert result['query'] == incident.query
        assert result['dateStarted'] == incident.date_started
        assert result['dateDetected'] == incident.date_detected
        assert result['dateAdded'] == incident.date_added
        assert result['dateClosed'] == incident.date_closed
        assert len(result['eventStats']['data']) == 52
        assert [data[1] for data in result['eventStats']['data']] == [[]] * 52
        assert result['totalEvents'] == 0
        assert result['uniqueUsers'] == 0


class DetailedIncidentSerializerTest(TestCase):
    def test_subscribed(self):
        incident = self.create_incident(date_started=timezone.now() - timedelta(minutes=5))
        serializer = DetailedIncidentSerializer()
        result = serialize(incident, serializer=serializer, user=self.user)
        assert not result['isSubscribed']
        subscribe_to_incident(incident, self.user)
        result = serialize(incident, serializer=serializer, user=self.user)
        assert result['isSubscribed']

    def test_groups(self):
        incident = self.create_incident()
        serializer = DetailedIncidentSerializer()
        result = serialize(incident, serializer=serializer)
        assert result['groups'] == []
        IncidentGroup.objects.create(incident=incident, group=self.group)
        result = serialize(incident, serializer=serializer)
        assert result['groups'] == [six.text_type(self.group.id)]
