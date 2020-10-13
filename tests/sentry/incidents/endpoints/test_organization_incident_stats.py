from __future__ import absolute_import

from datetime import datetime, timedelta
from uuid import uuid4

from django.utils.functional import cached_property
from exam import fixture
from freezegun import freeze_time
from pytz import utc

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format


@freeze_time()
class OrganizationIncidentDetailsTest(SnubaTestCase, APITestCase):
    endpoint = "sentry-api-0-organization-incident-stats"

    def setUp(self):
        super(OrganizationIncidentDetailsTest, self).setUp()
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

    @fixture
    def organization(self):
        return self.create_organization(owner=self.create_user())

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    def create_event(self, timestamp, fingerprint=None, user=None):
        event_id = uuid4().hex
        if fingerprint is None:
            fingerprint = event_id

        data = {
            "event_id": event_id,
            "fingerprint": [fingerprint],
            "timestamp": iso_format(timestamp),
            "type": "error",
            "exception": [{"type": "Foo"}],
        }
        if user:
            data["user"] = user
        return self.store_event(data=data, project_id=self.project.id)

    @cached_property
    def now(self):
        return datetime.utcnow().replace(minute=0, second=0, microsecond=0, tzinfo=utc)

    @fixture
    def bucket_incident(self):
        incident_start = self.now - timedelta(minutes=23)
        self.create_event(incident_start + timedelta(seconds=1))
        self.create_event(incident_start + timedelta(minutes=2))
        self.create_event(incident_start + timedelta(minutes=6))
        self.create_event(incident_start + timedelta(minutes=9, seconds=59))
        self.create_event(incident_start + timedelta(minutes=14))
        self.create_event(incident_start + timedelta(minutes=16))
        alert_rule = self.create_alert_rule(time_window=10)
        return self.create_incident(date_started=incident_start, query="", alert_rule=alert_rule)

    def test_no_perms(self):
        incident = self.create_incident()
        self.login_as(self.create_user())
        with self.feature("organizations:incidents"):
            resp = self.get_response(incident.organization.slug, incident.id)
        assert resp.status_code == 403

    def test_no_feature(self):
        incident = self.create_incident()
        resp = self.get_response(incident.organization.slug, incident.id)
        assert resp.status_code == 404

    def test_simple(self):
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(
                self.bucket_incident.organization.slug, self.bucket_incident.identifier
            )

        assert resp.data["totalEvents"] == 6
        assert resp.data["uniqueUsers"] == 0
        for i, data in enumerate(resp.data["eventStats"]["data"]):
            if data[1]:
                break
        # We don't care about the empty rows, we just want to find this block of rows
        # with counts somewhere in the data
        assert [data[1] for data in resp.data["eventStats"]["data"][i : i + 4]] == [
            [{"count": 2}],
            [{"count": 4}],
            [{"count": 2}],
            [{"count": 2}],
        ]

    def test_start_bucket_outside_range(self):
        now = self.now - timedelta(minutes=1)
        with freeze_time(now):
            incident_start = now - timedelta(minutes=2)
            self.create_event(incident_start - timedelta(minutes=1))
            self.create_event(incident_start - timedelta(minutes=6))
            self.create_event(incident_start + timedelta(minutes=1))
            alert_rule = self.create_alert_rule(time_window=30)
            incident = self.create_incident(
                date_started=incident_start, query="", alert_rule=alert_rule
            )

            with self.feature("organizations:incidents"):
                resp = self.get_valid_response(incident.organization.slug, incident.identifier)

            assert resp.data["totalEvents"] == 3
            assert resp.data["uniqueUsers"] == 0
            for i, data in enumerate(resp.data["eventStats"]["data"]):
                if data[1]:
                    break
            # We don't care about the empty rows, we just want to find this block of rows
            # with counts somewhere in the data
            assert [data[1] for data in resp.data["eventStats"]["data"][i : i + 3]] == [
                [{"count": 3}],
                [{"count": 1}],
            ]
