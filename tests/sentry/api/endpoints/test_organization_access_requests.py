from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import OrganizationAccessRequest
from sentry.testutils import APITestCase


class UpdateOrganizationAccessRequestTest(APITestCase):
    def test_owner_can_list_access_requests(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        user = self.create_user("bar@example.com")
        member = self.create_member(organization=organization, user=user, role="member")
        team = self.create_team(name="foo", organization=organization)

        OrganizationAccessRequest.objects.create(member=member, team=team)

        path = reverse("sentry-api-0-organization-access-requests", args=[organization.slug])

        resp = self.client.get(path)

        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["member"]["email"] == "bar@example.com"

    def test_admin_can_list_access_requests(self):
        organization = self.create_organization(
            name="foo", owner=self.user, flags=0  # kill default allow_joinleave
        )
        team_1 = self.create_team(name="foo", organization=organization)

        # team which this team_admin user is not an admin of
        team_2 = self.create_team(name="bar", organization=organization)

        team_admin = self.create_user("admin@example.com")
        self.create_member(organization=organization, user=team_admin, role="admin", teams=[team_1])

        other_user = self.create_user("bar@example.com")
        other_member = self.create_member(
            organization=organization, user=other_user, role="member", teams=[]
        )

        request_1 = OrganizationAccessRequest.objects.create(member=other_member, team=team_1)
        OrganizationAccessRequest.objects.create(member=other_member, team=team_2)

        path = reverse("sentry-api-0-organization-access-requests", args=[organization.slug])

        self.login_as(team_admin)

        resp = self.client.get(path)

        assert resp.status_code == 200

        # There are requests to two diff teams, make sure we only get the one user is team admin for
        assert len(resp.data) == 1
        assert resp.data[0]["member"]["id"] == six.text_type(other_member.id)
        assert resp.data[0]["member"]["id"] == six.text_type(request_1.member_id)
        assert resp.data[0]["team"]["id"] == six.text_type(request_1.team_id)

    def test_member_empty_results(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        user = self.create_user("bar@example.com")
        member = self.create_member(organization=organization, user=user, role="member")
        team = self.create_team(name="foo", organization=organization)

        OrganizationAccessRequest.objects.create(member=member, team=team)

        user = self.create_user("foo@example.com")
        member = self.create_member(organization=organization, user=user, role="member")

        path = reverse("sentry-api-0-organization-access-requests", args=[organization.slug])

        self.login_as(user=user)
        resp = self.client.get(path)

        assert resp.status_code == 200
        assert len(resp.data) == 0
