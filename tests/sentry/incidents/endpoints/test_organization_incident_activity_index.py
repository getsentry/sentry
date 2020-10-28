from __future__ import absolute_import

from datetime import timedelta

from django.utils import timezone
from exam import fixture

from sentry.api.serializers import serialize
from sentry.incidents.logic import create_incident_activity
from sentry.incidents.models import IncidentActivityType
from sentry.testutils import APITestCase


class OrganizationIncidentActivityIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-incident-activity"

    def setUp(self):
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
        incident = self.create_incident(
            date_started=timezone.now() - timedelta(hours=2), projects=[self.project], query=""
        )
        activities = [
            create_incident_activity(
                incident=incident,
                activity_type=IncidentActivityType.CREATED,
                user=self.user,
                comment="hello",
            ),
            create_incident_activity(
                incident=incident,
                activity_type=IncidentActivityType.COMMENT,
                user=self.user,
                comment="goodbye",
            ),
        ]

        expected = serialize(activities, user=self.user)

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(incident.organization.slug, incident.identifier, desc=0)
        assert resp.data == expected

        expected.reverse()
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(incident.organization.slug, incident.identifier)
        assert resp.data == expected
