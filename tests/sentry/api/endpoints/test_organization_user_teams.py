from sentry.testutils import APITestCase


class OrganizationUserTeamsTest(APITestCase):
    endpoint = "sentry-api-0-organization-user-teams"

    def setUp(self):
        self.foo = self.create_user("foo@example.com")
        self.bar = self.create_user("bar@example.com", is_superuser=True)
        self.org = self.create_organization(owner=self.user)
        self.team1 = self.create_team(organization=self.org)
        self.team2 = self.create_team(organization=self.org)
        self.team3 = self.create_team(organization=self.org)
        self.project1 = self.create_project(teams=[self.team1])
        self.project2 = self.create_project(teams=[self.team2])
        self.create_member(organization=self.org, user=self.foo, teams=[self.team1, self.team2])
        self.create_member(organization=self.org, user=self.bar, teams=[self.team2])

    def test_simple(self):
        self.login_as(user=self.foo)

        response = self.get_valid_response(self.org.slug)

        # Verify that only teams that the user is a member of, are returned
        assert len(response.data) == 2

        # Sort teams so there is a guaranteed ordering
        response.data.sort(key=lambda x: x["id"])
        assert response.data[0]["id"] == str(self.team1.id)
        assert response.data[0]["isMember"]
        assert response.data[0]["projects"][0]["id"] == str(self.project1.id)

        assert response.data[1]["id"] == str(self.team2.id)
        assert response.data[1]["isMember"]
        assert response.data[1]["projects"][0]["id"] == str(self.project2.id)

    def test_super_user(self):
        self.login_as(user=self.bar, superuser=True)

        response = self.get_valid_response(self.org.slug)

        # Verify that all teams are returned
        assert len(response.data) == 3

        # Sort teams so there is a guaranteed ordering
        response.data.sort(key=lambda x: x["id"])
        assert response.data[0]["id"] == str(self.team1.id)
        assert not response.data[0]["isMember"]
        assert response.data[0]["projects"][0]["id"] == str(self.project1.id)

        assert response.data[1]["id"] == str(self.team2.id)
        assert response.data[1]["isMember"]
        assert response.data[1]["projects"][0]["id"] == str(self.project2.id)

        assert response.data[2]["id"] == str(self.team3.id)
        assert not response.data[2]["isMember"]
