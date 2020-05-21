from __future__ import absolute_import

from exam import fixture

from sentry.incidents.logic import subscribe_to_incident
from sentry.incidents.models import IncidentSubscription
from sentry.testutils import APITestCase


class BaseOrganizationSubscriptionEndpointTest(object):
    endpoint = "sentry-api-0-organization-incident-subscription-index"

    @fixture
    def organization(self):
        return self.create_organization()

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    def test_access(self):
        other_user = self.create_user()
        self.login_as(other_user)
        other_team = self.create_team()
        self.create_member(
            user=self.user, organization=self.organization, role="member", teams=[self.team]
        )
        other_project = self.create_project(teams=[other_team])
        incident = self.create_incident(projects=[other_project])
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, incident.identifier, comment="hi")
            assert resp.status_code == 403


class OrganizationIncidentSubscribeEndpointTest(
    BaseOrganizationSubscriptionEndpointTest, APITestCase
):
    method = "post"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            self.get_valid_response(self.organization.slug, incident.identifier, status_code=201)
        sub = IncidentSubscription.objects.filter(incident=incident, user=self.user).get()
        assert sub.incident == incident
        assert sub.user == self.user


class OrganizationIncidentUnsubscribeEndpointTest(
    BaseOrganizationSubscriptionEndpointTest, APITestCase
):
    method = "delete"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        incident = self.create_incident()
        subscribe_to_incident(incident, self.user)
        with self.feature("organizations:incidents"):
            self.get_valid_response(self.organization.slug, incident.identifier, status_code=200)
        assert not IncidentSubscription.objects.filter(incident=incident, user=self.user).exists()
