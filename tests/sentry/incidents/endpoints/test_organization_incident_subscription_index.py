from functools import cached_property

from sentry.incidents.logic import subscribe_to_incident
from sentry.incidents.models import IncidentSubscription
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


class BaseOrganizationSubscriptionEndpointTest(APITestCase):
    __test__ = Abstract(__module__, __qualname__)

    endpoint = "sentry-api-0-organization-incident-subscription-index"

    @cached_property
    def organization(self):
        return self.create_organization()

    @cached_property
    def project(self):
        return self.create_project(organization=self.organization)

    @cached_property
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


@region_silo_test
class OrganizationIncidentSubscribeEndpointTest(BaseOrganizationSubscriptionEndpointTest):
    method = "post"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        incident = self.create_incident()
        with self.feature("organizations:incidents"):
            self.get_success_response(self.organization.slug, incident.identifier, status_code=201)
        sub = IncidentSubscription.objects.filter(incident=incident, user_id=self.user.id).get()
        assert sub.incident == incident
        assert sub.user_id == self.user.id


@region_silo_test
class OrganizationIncidentUnsubscribeEndpointTest(BaseOrganizationSubscriptionEndpointTest):
    method = "delete"

    def test_simple(self):
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)
        incident = self.create_incident()
        subscribe_to_incident(incident, self.user.id)
        with self.feature("organizations:incidents"):
            self.get_success_response(self.organization.slug, incident.identifier, status_code=200)
        assert not IncidentSubscription.objects.filter(
            incident=incident, user_id=self.user.id
        ).exists()
