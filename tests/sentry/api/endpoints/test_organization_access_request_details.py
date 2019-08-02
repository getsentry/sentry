from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import OrganizationAccessRequest, OrganizationMemberTeam
from sentry.testutils import APITestCase


class UpdateOrganizationAccessRequestTest(APITestCase):
    def test_approve_request(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        user = self.create_user("bar@example.com")
        member = self.create_member(organization=organization, user=user, role="member")
        team = self.create_team(name="foo", organization=organization)

        access_request = OrganizationAccessRequest.objects.create(member=member, team=team)

        path = reverse(
            "sentry-api-0-organization-access-request-details",
            args=[organization.slug, access_request.id],
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={"isApproved": 1})

        assert resp.status_code == 204

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member, team=team, is_active=True
        ).exists()

        assert not OrganizationAccessRequest.objects.filter(id=access_request.id).exists()

    def test_deny_request(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        user = self.create_user("bar@example.com")
        member = self.create_member(organization=organization, user=user, role="member")
        team = self.create_team(name="foo", organization=organization)

        access_request = OrganizationAccessRequest.objects.create(member=member, team=team)

        path = reverse(
            "sentry-api-0-organization-access-request-details",
            args=[organization.slug, access_request.id],
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={"isApproved": 0})

        assert resp.status_code == 204

        assert not OrganizationMemberTeam.objects.filter(
            organizationmember=member, team=team, is_active=True
        ).exists()

        assert not OrganizationAccessRequest.objects.filter(id=access_request.id).exists()

    def test_team_admin_can_approve(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        user = self.create_user("bar@example.com")
        member = self.create_member(organization=organization, user=user, role="member")
        team = self.create_team(name="foo", organization=organization)

        access_request = OrganizationAccessRequest.objects.create(member=member, team=team)

        admin_user = self.create_user("admin@example.com")
        self.create_member(organization=organization, user=admin_user, role="admin", teams=[team])

        path = reverse(
            "sentry-api-0-organization-access-request-details",
            args=[organization.slug, access_request.id],
        )

        self.login_as(admin_user)

        resp = self.client.put(path, data={"isApproved": 1})

        assert resp.status_code == 204

    def test_teamless_admin_cannot_approve_with_closed_membership(self):
        self.login_as(user=self.user)

        organization = self.create_organization(
            name="foo", owner=self.user, flags=0  # kill allow_joinleave
        )
        user = self.create_user("bar@example.com")
        member = self.create_member(organization=organization, user=user, role="member")
        team = self.create_team(name="foo", organization=organization)

        access_request = OrganizationAccessRequest.objects.create(member=member, team=team)

        admin_user = self.create_user("admin@example.com")
        self.create_member(organization=organization, user=admin_user, role="admin", teams=[])

        path = reverse(
            "sentry-api-0-organization-access-request-details",
            args=[organization.slug, access_request.id],
        )

        self.login_as(admin_user)

        resp = self.client.put(path, data={"isApproved": 1})

        assert resp.status_code == 403
