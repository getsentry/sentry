from django.urls import reverse

from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.testutils.cases import APITestCase


class GetOrganizationAccessRequestTest(APITestCase):
    def test_only_returns_valid_requests(self):
        owner_user = self.create_user("owner@example.com")
        organization = self.create_organization(owner=owner_user)
        team = self.create_team(organization=organization)
        self.create_team_membership(team=team, user=owner_user)
        joined_team_member = self.create_member(
            organization=organization,
            role="member",
            user=self.create_user("joined-team@example.com"),
        )
        invite_email_member = self.create_member(
            organization=organization,
            role="member",
            email="invite-email@example.com",
        )
        not_joined_team_member = self.create_member(
            organization=organization,
            role="member",
            user=self.create_user("not-joined-team@example.com"),
        )
        OrganizationAccessRequest.objects.create(member=joined_team_member, team=team)
        OrganizationAccessRequest.objects.create(member=invite_email_member, team=team)
        not_joined_request = OrganizationAccessRequest.objects.create(
            member=not_joined_team_member, team=team
        )
        self.create_team_membership(team=team, member=joined_team_member)

        self.login_as(owner_user)
        resp = self.client.get(
            reverse("sentry-api-0-organization-access-requests", args=[organization.slug])
        )

        # We omit the request that has already been fulfilled by a user joining the team some other way.
        # We also omit email invites to teams (since those cannot be approved until the user creates a Sentry account)
        assert len(resp.data) == 1
        assert resp.data[0]["id"] == str(not_joined_request.id)
        assert resp.data[0]["member"]["id"] == str(not_joined_request.member.id)
        assert resp.data[0]["team"]["id"] == str(not_joined_request.team.id)


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
