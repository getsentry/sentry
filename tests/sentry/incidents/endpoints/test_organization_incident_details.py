from functools import cached_property

from sentry.api.serializers import serialize
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time


class BaseIncidentDetailsTest(APITestCase):
    __test__ = Abstract(__module__, __qualname__)

    endpoint = "sentry-api-0-organization-incident-details"

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


class OrganizationIncidentDetailsTest(BaseIncidentDetailsTest):
    @freeze_time()
    def test_simple(self):
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(incident.organization.slug, incident.identifier)

        expected = serialize(incident)

        assert resp.data["id"] == expected["id"]
        assert resp.data["identifier"] == expected["identifier"]
        assert resp.data["projects"] == expected["projects"]
        assert resp.data["dateDetected"] == expected["dateDetected"]
        assert resp.data["dateCreated"] == expected["dateCreated"]
        assert resp.data["projects"] == expected["projects"]


class OrganizationIncidentUpdateStatusTest(BaseIncidentDetailsTest):
    method = "put"

    def get_success_response(self, *args, **params):
        params.setdefault("status", IncidentStatus.CLOSED.value)
        return super().get_success_response(*args, **params)

    def test_simple(self):
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            self.get_success_response(
                incident.organization.slug, incident.identifier, status=IncidentStatus.CLOSED.value
            )

        incident = Incident.objects.get(id=incident.id)
        assert incident.status == IncidentStatus.CLOSED.value

    def test_cannot_open(self):
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            resp = self.get_response(
                incident.organization.slug, incident.identifier, status=IncidentStatus.OPEN.value
            )
            assert resp.status_code == 400
            assert resp.data.startswith("Status cannot be changed")

    def test_invalid_status(self):
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            resp = self.get_response(incident.organization.slug, incident.identifier, status=5000)
            assert resp.status_code == 400
            assert resp.data["status"][0].startswith("Invalid value for status")
