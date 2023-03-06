from functools import cached_property

from freezegun import freeze_time

from sentry.api.serializers import serialize
from sentry.incidents.models import Incident, IncidentActivity, IncidentStatus
from sentry.testutils import APITestCase
from sentry.testutils.silo import exempt_from_silo_limits, region_silo_test


class BaseIncidentDetailsTest:
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


@region_silo_test(stable=True)
class OrganizationIncidentDetailsTest(BaseIncidentDetailsTest, APITestCase):
    @freeze_time()
    def test_simple(self):
        incident = self.create_incident(seen_by=[self.user])
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(incident.organization.slug, incident.identifier)

        expected = serialize(incident)

        with exempt_from_silo_limits():
            user_data = serialize(self.user)
        seen_by = [user_data]

        assert resp.data["id"] == expected["id"]
        assert resp.data["identifier"] == expected["identifier"]
        assert resp.data["projects"] == expected["projects"]
        assert resp.data["dateDetected"] == expected["dateDetected"]
        assert resp.data["dateCreated"] == expected["dateCreated"]
        assert resp.data["projects"] == expected["projects"]
        assert [item["id"] for item in resp.data["seenBy"]] == [item["id"] for item in seen_by]


@region_silo_test(stable=True)
class OrganizationIncidentUpdateStatusTest(BaseIncidentDetailsTest, APITestCase):
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

    def test_comment(self):
        incident = self.create_incident()
        status = IncidentStatus.CLOSED.value
        comment = "fixed"
        with self.feature("organizations:incidents"):
            self.get_success_response(
                incident.organization.slug, incident.identifier, status=status, comment=comment
            )

        incident = Incident.objects.get(id=incident.id)
        assert incident.status == status
        activity = IncidentActivity.objects.filter(incident=incident).order_by("-id")[:1].get()
        assert activity.value == str(status)
        assert activity.comment == comment
        assert activity.user_id == self.user.id

    def test_invalid_status(self):
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            resp = self.get_response(incident.organization.slug, incident.identifier, status=5000)
            assert resp.status_code == 400
            assert resp.data["status"][0].startswith("Invalid value for status")
