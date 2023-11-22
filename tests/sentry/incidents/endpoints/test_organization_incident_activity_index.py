from datetime import timedelta
from functools import cached_property

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.incidents.logic import create_incident_activity
from sentry.incidents.models import IncidentActivityType
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationIncidentActivityIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-incident-activity"

    def setUp(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

    @cached_property
    def organization(self):
        return self.create_organization(owner=self.create_user())

    @cached_property
    def project(self):
        return self.create_project(organization=self.organization)

    @cached_property
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
            resp = self.get_success_response(
                incident.organization.slug, incident.identifier, desc=0
            )

        assert resp.data == expected

        expected.reverse()
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(incident.organization.slug, incident.identifier)

        assert resp.data == expected
