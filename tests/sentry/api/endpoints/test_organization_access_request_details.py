from django.urls import reverse

from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


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


class TeamAdminUpdateAccessRequestTest(APITestCase):
    endpoint = "sentry-api-0-organization-access-request-details"
    method = "put"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(flags=0)
        self.team = self.create_team(organization=self.organization)
        self.admin_member = self.create_member(
            organization=self.organization,
            user=self.user,
            role="member",
            team_roles=[(self.team, "admin")],
        )
        self.requesting_member = self.create_member(
            organization=self.organization, user=self.create_user()
        )
        self.access_request = self.create_organization_access_request(
            team=self.team, member=self.requesting_member
        )

    @with_feature("organizations:team-roles")
    def test_approve(self) -> None:
        self.login_as(self.user)
        self.get_success_response(
            self.organization.slug, self.access_request.id, isApproved=True, status_code=204
        )

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=self.requesting_member, team=self.team, is_active=True
        ).exists()
        assert not OrganizationAccessRequest.objects.filter(id=self.access_request.id).exists()

    @with_feature("organizations:team-roles")
    def test_deny(self) -> None:
        self.login_as(self.user)
        self.get_success_response(
            self.organization.slug, self.access_request.id, isApproved=False, status_code=204
        )

        assert not OrganizationMemberTeam.objects.filter(
            organizationmember=self.requesting_member, team=self.team
        ).exists()
        assert not OrganizationAccessRequest.objects.filter(id=self.access_request.id).exists()

    @with_feature("organizations:team-roles")
    def test_contributor_cannot_approve(self) -> None:
        contributor_team = self.create_team(organization=self.organization)
        self.create_team_membership(
            team=contributor_team, member=self.admin_member, role="contributor"
        )
        access_request = self.create_organization_access_request(
            team=contributor_team, member=self.requesting_member
        )
        self.login_as(self.user)
        self.get_error_response(
            self.organization.slug, access_request.id, isApproved=True, status_code=403
        )

        assert OrganizationAccessRequest.objects.filter(id=access_request.id).exists()
        assert not OrganizationMemberTeam.objects.filter(
            organizationmember=self.requesting_member, team=contributor_team
        ).exists()

    @with_feature("organizations:team-roles")
    def test_cannot_deny_for_unrelated_team(self) -> None:
        unrelated_team = self.create_team(organization=self.organization)
        access_request = self.create_organization_access_request(
            team=unrelated_team, member=self.requesting_member
        )
        self.login_as(self.user)
        self.get_error_response(
            self.organization.slug, access_request.id, isApproved=False, status_code=403
        )

        assert OrganizationAccessRequest.objects.filter(id=access_request.id).exists()

    @with_feature("organizations:team-roles")
    def test_cannot_approve_request_from_another_organization(self) -> None:
        other_org = self.create_organization()
        other_team = self.create_team(organization=other_org)
        self.create_member(
            organization=other_org, user=self.user, team_roles=[(other_team, "admin")]
        )
        access_request = self.create_organization_access_request(
            team=other_team,
            member=self.create_member(organization=other_org, user=self.create_user()),
        )
        self.login_as(self.user)
        self.get_error_response(
            self.organization.slug, access_request.id, isApproved=True, status_code=404
        )

        assert OrganizationAccessRequest.objects.filter(id=access_request.id).exists()

    def test_team_roles_disabled(self) -> None:
        self.login_as(self.user)
        with self.feature({"organizations:team-roles": False}):
            self.get_error_response(
                self.organization.slug, self.access_request.id, isApproved=True, status_code=403
            )

        assert OrganizationAccessRequest.objects.filter(id=self.access_request.id).exists()

    @with_feature("organizations:team-roles")
    def test_read_only_token_cannot_approve(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["org:read"])
        self.get_error_response(
            self.organization.slug,
            self.access_request.id,
            isApproved=True,
            status_code=403,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
        )

        assert OrganizationAccessRequest.objects.filter(id=self.access_request.id).exists()

    @with_feature("organizations:team-roles")
    def test_write_token_can_approve(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["org:read", "team:write"])
        self.get_success_response(
            self.organization.slug,
            self.access_request.id,
            isApproved=True,
            status_code=204,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
        )

        assert OrganizationMemberTeam.objects.filter(
            organizationmember=self.requesting_member, team=self.team, is_active=True
        ).exists()
        assert not OrganizationAccessRequest.objects.filter(id=self.access_request.id).exists()
