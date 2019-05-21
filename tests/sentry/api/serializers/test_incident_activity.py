# -*- coding: utf-8 -*-

from __future__ import absolute_import


import six

from sentry.api.serializers import serialize
from sentry.incidents.models import IncidentActivityType
from sentry.incidents.logic import create_incident_activity
from sentry.testutils import TestCase


class IncidentSerializerTest(TestCase):
    def test_simple(self):
        activity = create_incident_activity(
            incident=self.create_incident(),
            activity_type=IncidentActivityType.COMMENT,
            user=self.user,
            comment='hello',
        )
        result = serialize(activity)

        assert result['id'] == six.text_type(activity.id)
        assert result['incidentIdentifier'] == six.text_type(activity.incident.identifier)
        assert result['userId'] == six.text_type(activity.user_id)
        assert result['type'] == activity.type
        assert result['value'] is None
        assert result['previousValue'] is None
        assert result['comment'] == activity.comment
