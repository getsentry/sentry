# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta

import six
from django.utils import timezone
from freezegun import freeze_time

from sentry.api.serializers import serialize
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
        assert result['title'] == incident.title
        assert result['query'] == incident.query
        assert result['dateStarted'] == incident.date_started
        assert result['dateDetected'] == incident.date_detected
        assert result['dateAdded'] == incident.date_added
        assert result['dateClosed'] == incident.date_closed
        assert len(result['eventStats']['data']) == 22
        assert [data[1] for data in result['eventStats']['data']] == [[]] * 22
        assert result['totalEvents'] == 0
        assert result['uniqueUsers'] == 0
