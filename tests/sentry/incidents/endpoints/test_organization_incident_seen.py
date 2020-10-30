from __future__ import absolute_import

from exam import fixture

from django.core.urlresolvers import reverse
from sentry.incidents.models import IncidentSeen
from sentry.testutils import APITestCase


class OrganizationIncidentSeenTest(APITestCase):
    method = "post"
    endpoint = "sentry-api-0-organization-incident-seen"

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

    def test_has_user_seen(self):
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            resp = self.get_response(incident.organization.slug, incident.identifier)

            assert resp.status_code == 201

            # should not be seen by different user
            new_user = self.create_user()
            self.create_member(user=new_user, organization=self.organization, teams=[self.team])
            self.login_as(new_user)

            seen_incidents = IncidentSeen.objects.filter(incident=incident)
            assert len(seen_incidents) == 1
            assert seen_incidents[0].user == self.user

            # mark set as seen by new_user
            resp = self.get_response(incident.organization.slug, incident.identifier)
            assert resp.status_code == 201

            seen_incidents = IncidentSeen.objects.filter(incident=incident)
            assert len(seen_incidents) == 2
            assert seen_incidents[0].user == self.user
            assert seen_incidents[1].user == new_user

            url = reverse(
                "sentry-api-0-organization-incident-details",
                kwargs={
                    "organization_slug": incident.organization.slug,
                    "incident_identifier": incident.identifier,
                },
            )

            resp = self.client.get(url, format="json")
            assert resp.status_code == 200
            assert resp.data["hasSeen"]

            assert len(resp.data["seenBy"]) == 2
            # seenBy is sorted by most recently seen
            assert resp.data["seenBy"][0]["username"] == new_user.username
            assert resp.data["seenBy"][1]["username"] == self.user.username
