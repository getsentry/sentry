from django.urls import reverse

from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class UpdateOrganizationAccessRequestTest(APITestCase):
    def test_owner_can_list_access_requests(self) -> None:
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

    def test_admin_can_list_access_requests(self) -> None:
        organization = self.create_organization(
            name="foo",
            owner=self.user,
            flags=0,  # kill default allow_joinleave
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
        assert resp.data[0]["member"]["id"] == str(other_member.id)
        assert resp.data[0]["member"]["id"] == str(request_1.member_id)
        assert resp.data[0]["team"]["id"] == str(request_1.team_id)

    def test_member_empty_results(self) -> None:
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


class TeamAdminAccessRequestsTest(APITestCase):
    endpoint = "sentry-api-0-organization-access-requests"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(flags=0)
        self.team = self.create_team(organization=self.organization)
        self.contributor_team = self.create_team(organization=self.organization)
        self.admin_member = self.create_member(
            organization=self.organization,
            user=self.user,
            role="member",
            team_roles=[(self.team, "admin"), (self.contributor_team, "contributor")],
        )
        self.requesting_member = self.create_member(
            organization=self.organization, user=self.create_user()
        )
        self.access_request = self.create_organization_access_request(
            team=self.team, member=self.requesting_member
        )

    @with_feature("organizations:team-roles")
    def test_only_lists_requests_for_managed_teams(self) -> None:
        self.create_organization_access_request(
            team=self.contributor_team, member=self.requesting_member
        )
        unrelated_team = self.create_team(organization=self.organization)
        self.create_organization_access_request(team=unrelated_team, member=self.requesting_member)
        inactive_team = self.create_team(organization=self.organization)
        self.create_team_membership(
            team=inactive_team, member=self.admin_member, role="admin"
        ).update(is_active=False)
        self.create_organization_access_request(team=inactive_team, member=self.requesting_member)
        other_org = self.create_organization()
        other_team = self.create_team(organization=other_org)
        self.create_member(
            organization=other_org, user=self.user, team_roles=[(other_team, "admin")]
        )
        self.create_organization_access_request(
            team=other_team,
            member=self.create_member(organization=other_org, user=self.create_user()),
        )

        self.login_as(self.user)
        response = self.get_success_response(self.organization.slug)

        assert [request["id"] for request in response.data] == [str(self.access_request.id)]

    def test_team_roles_disabled(self) -> None:
        self.login_as(self.user)
        with self.feature({"organizations:team-roles": False}):
            response = self.get_success_response(self.organization.slug)

        assert response.data == []

    @with_feature("organizations:team-roles")
    def test_read_only_token_cannot_list_requests(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["org:read"])
        response = self.get_success_response(
            self.organization.slug,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
        )

        assert response.data == []
