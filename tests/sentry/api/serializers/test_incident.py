# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.testutils import TestCase


class IncidentSerializerTest(TestCase):
    def test_simple(self):
        incident = self.create_incident()
        result = serialize(incident)

        assert result['id'] == six.text_type(incident.id)
        assert result['identifier'] == incident.identifier
        assert result['organizationId'] == six.text_type(incident.organization_id)
        assert result['projects'] == [p.slug for p in incident.projects.all()]
        assert result['status'] == incident.status
        assert result['title'] == incident.title
        assert result['query'] == incident.query
        assert result['dateStarted'] == incident.date_started
        assert result['dateDetected'] == incident.date_detected
        assert result['dateAdded'] == incident.date_added
        assert result['dateClosed'] == incident.date_closed
