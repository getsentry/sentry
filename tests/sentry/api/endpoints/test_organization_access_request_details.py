from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode


class GetOrganizationAccessRequestTest(APITestCase):
    def test_only_returns_valid_requests(self) -> None:
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

    def test_read_only_token_can_list_requests(self) -> None:
        owner_user = self.create_user("owner2@example.com")
        organization = self.create_organization(owner=owner_user)
        team = self.create_team(organization=organization)
        requesting_user = self.create_user("requester@example.com")
        member = self.create_member(
            organization=organization,
            role="member",
            user=requesting_user,
        )
        access_request = OrganizationAccessRequest.objects.create(member=member, team=team)

        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=owner_user, scope_list=["org:read"])

        resp = self.client.get(
            reverse("sentry-api-0-organization-access-requests", args=[organization.slug]),
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )

        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["id"] == str(access_request.id)

    def test_team_read_token_sees_own_team_requests(self) -> None:
        owner_user = self.create_user("owner3@example.com")
        organization = self.create_organization(owner=owner_user)
        team_a = self.create_team(organization=organization)
        team_b = self.create_team(organization=organization)

        # token_user is a member of team_a but NOT team_b
        token_user = self.create_user("token-user@example.com")
        self.create_member(
            organization=organization,
            role="member",
            user=token_user,
            teams=[team_a],
        )

        # Two different users request to join team_a and team_b respectively
        requester_a = self.create_user("requester-a@example.com")
        member_a = self.create_member(
            organization=organization,
            role="member",
            user=requester_a,
        )
        requester_b = self.create_user("requester-b@example.com")
        member_b = self.create_member(
            organization=organization,
            role="member",
            user=requester_b,
        )

        access_request_a = OrganizationAccessRequest.objects.create(member=member_a, team=team_a)
        OrganizationAccessRequest.objects.create(member=member_b, team=team_b)

        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=token_user, scope_list=["team:read"])

        resp = self.client.get(
            reverse("sentry-api-0-organization-access-requests", args=[organization.slug]),
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )

        assert resp.status_code == 200
        # Should only see team_a's request (the team token_user belongs to)
        assert len(resp.data) == 1
        assert resp.data[0]["id"] == str(access_request_a.id)


class UpdateOrganizationAccessRequestTest(APITestCase):
    def test_approve_request(self) -> None:
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

    def test_deny_request(self) -> None:
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

    def test_team_admin_can_approve(self) -> None:
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

    def test_teamless_admin_cannot_approve_with_closed_membership(self) -> None:
        self.login_as(user=self.user)

        organization = self.create_organization(
            name="foo",
            owner=self.user,
            flags=0,  # kill allow_joinleave
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
