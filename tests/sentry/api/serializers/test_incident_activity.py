# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import datetime, timedelta
from uuid import uuid4

import six
from django.utils import timezone
from freezegun import freeze_time

from sentry.api.serializers import serialize
from sentry.incidents.models import IncidentActivityType
from sentry.incidents.logic import create_incident_activity
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class IncidentActivitySerializerTest(TestCase, SnubaTestCase):
    def test_simple(self):
        activity = create_incident_activity(
            incident=self.create_incident(),
            activity_type=IncidentActivityType.COMMENT,
            user=self.user,
            comment="hello",
        )
        result = serialize(activity)

        assert result["id"] == six.text_type(activity.id)
        assert result["incidentIdentifier"] == six.text_type(activity.incident.identifier)
        assert result["user"] == serialize(activity.user)
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

        assert result["id"] == six.text_type(activity.id)
        assert result["incidentIdentifier"] == six.text_type(activity.incident.identifier)
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

            assert result["id"] == six.text_type(activity.id)
            assert result["incidentIdentifier"] == six.text_type(activity.incident.identifier)
            assert result["user"] == serialize(activity.user)
            assert result["type"] == activity.type
            assert result["value"] is None
            assert result["previousValue"] is None
            assert result["comment"] == activity.comment
            assert result["dateCreated"] == activity.date_added
