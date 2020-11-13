from __future__ import absolute_import

from datetime import datetime

from sentry.utils.compat import mock
import pytz
import six
from exam import fixture

from sentry.api.serializers import serialize
from sentry.incidents.models import Incident, IncidentActivity, IncidentStatus
from sentry.testutils import APITestCase


class BaseIncidentDetailsTest(object):
    endpoint = "sentry-api-0-organization-incident-details"

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


class OrganizationIncidentDetailsTest(BaseIncidentDetailsTest, APITestCase):
    @mock.patch("django.utils.timezone.now")
    def test_simple(self, mock_now):
        mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)

        incident = self.create_incident(seen_by=[self.user])
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(incident.organization.slug, incident.identifier)

        expected = serialize(incident)

        user_data = serialize(self.user)
        seen_by = [user_data]

        assert resp.data["id"] == expected["id"]
        assert resp.data["identifier"] == expected["identifier"]
        assert resp.data["projects"] == expected["projects"]
        assert resp.data["dateDetected"] == expected["dateDetected"]
        assert resp.data["dateCreated"] == expected["dateCreated"]
        assert resp.data["projects"] == expected["projects"]
        assert resp.data["seenBy"] == seen_by


class OrganizationIncidentUpdateStatusTest(BaseIncidentDetailsTest, APITestCase):
    method = "put"

    def get_valid_response(self, *args, **params):
        params.setdefault("status", IncidentStatus.CLOSED.value)
        return super(OrganizationIncidentUpdateStatusTest, self).get_valid_response(*args, **params)

    def test_simple(self):
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            self.get_valid_response(
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
        comment = "fixd"
        with self.feature("organizations:incidents"):
            self.get_valid_response(
                incident.organization.slug, incident.identifier, status=status, comment=comment
            )

        incident = Incident.objects.get(id=incident.id)
        assert incident.status == status
        activity = IncidentActivity.objects.filter(incident=incident).order_by("-id")[:1].get()
        assert activity.value == six.text_type(status)
        assert activity.comment == comment
        assert activity.user == self.user

    def test_invalid_status(self):
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            resp = self.get_response(incident.organization.slug, incident.identifier, status=5000)
            assert resp.status_code == 400
            assert resp.data["status"][0].startswith("Invalid value for status")
