from django.urls import reverse

from sentry.models.organizationmember import InviteStatus
from sentry.testutils.cases import APITestCase


class ProjectMemberIndexTest(APITestCase):
    def test_simple(self):
        user_1 = self.create_user("foo@localhost", username="foo")
        user_2 = self.create_user("bar@localhost", username="bar")
        user_3 = self.create_user("baz@localhost", username="baz")
        org = self.create_organization(owner=user_1)
        team = self.create_team(organization=org, slug="baz")
        team_2 = self.create_team(organization=org, slug="bazinga")
        project_1 = self.create_project(teams=[team, team_2], slug="foo")
        self.create_project(teams=[team], slug="bar")
        self.create_member(organization=org, user=user_2, teams=[team])
        self.create_member(organization=org, user=user_3, teams=[team])

        self.login_as(user=user_2)

        url = reverse(
            "sentry-api-0-project-member-index",
            kwargs={
                "organization_id_or_slug": project_1.organization.slug,
                "project_id_or_slug": project_1.slug,
            },
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 2
        emails = {user["email"] for user in response.data}
        assert emails == {user_2.email, user_3.email}

    def test_email_id_comparison(self):
        # OrganizationMember email indicates the status of an invite, and is
        # cleared when the user is set
        invited_user = self.create_user()
        self.create_member(
            email=invited_user.email,
            organization=self.organization,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-member-index",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 2
        emails = {user["email"] for user in response.data}
        assert emails == {self.user.email, invited_user.email}
