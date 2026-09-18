from django.urls import reverse

from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import Feature


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

    def test_inactive_team_membership_is_not_listed_as_pending(self) -> None:
        organization = self.create_organization(name="foo", owner=self.user)
        requester = self.create_member(
            organization=organization,
            user=self.create_user("requester@example.com"),
            role="member",
        )
        team = self.create_team(name="foo", organization=organization)
        membership = self.create_team_membership(team=team, member=requester)
        membership.update(is_active=False)
        OrganizationAccessRequest.objects.create(member=requester, team=team)
        path = reverse("sentry-api-0-organization-access-requests", args=[organization.slug])

        self.login_as(self.user)
        resp = self.client.get(path)

        assert resp.status_code == 200
        assert resp.data == []

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

    def test_team_admin_only_lists_requests_for_managed_teams(self) -> None:
        organization = self.create_organization(
            name="foo",
            owner=self.user,
            flags=0,
        )
        managed_team = self.create_team(name="managed", organization=organization)
        other_team = self.create_team(name="other", organization=organization)
        team_admin = self.create_user("admin@example.com")
        team_admin_member = self.create_member(
            organization=organization,
            user=team_admin,
            role="member",
            teams=[managed_team],
            teamRole="admin",
        )
        self.create_team_membership(team=other_team, member=team_admin_member, role="contributor")
        requester = self.create_member(
            organization=organization,
            user=self.create_user("requester@example.com"),
            role="member",
        )
        managed_request = OrganizationAccessRequest.objects.create(
            member=requester, team=managed_team
        )
        OrganizationAccessRequest.objects.create(member=requester, team=other_team)
        path = reverse("sentry-api-0-organization-access-requests", args=[organization.slug])

        self.login_as(team_admin)
        with Feature({"organizations:team-roles": True}):
            resp = self.client.get(path)

        assert resp.status_code == 200
        assert [item["id"] for item in resp.data] == [str(managed_request.id)]

    def test_member_empty_results(self) -> None:
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        user = self.create_user("bar@example.com")
        member = self.create_member(organization=organization, user=user, role="member")
        team = self.create_team(name="foo", organization=organization)

        OrganizationAccessRequest.objects.create(member=member, team=team)

        user = self.create_user("foo@example.com")
        self.create_member(organization=organization, user=user, role="member")

        path = reverse("sentry-api-0-organization-access-requests", args=[organization.slug])

        self.login_as(user=user)
        resp = self.client.get(path)

        assert resp.status_code == 200
        assert len(resp.data) == 0
