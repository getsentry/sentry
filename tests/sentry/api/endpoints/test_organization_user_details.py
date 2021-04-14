from sentry.testutils import APITestCase


class OrganizationUserDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-user-details"

    def setUp(self):
        self.owner_user = self.create_user("foo@localhost", username="foo")
        self.user = self.create_user("bar@localhost", username="bar")

        self.org = self.create_organization(owner=self.owner_user)
        self.member = self.create_member(organization=self.org, user=self.user)

        self.login_as(user=self.owner_user)

    def test_gets_info_for_user_in_org(self):
        response = self.get_valid_response(self.org.slug, self.user.id)

        assert response.data["id"] == str(self.user.id)
        assert response.data["email"] == self.user.email

    def test_cannot_access_info_if_user_not_in_org(self):
        user = self.create_user("meep@localhost", username="meep")

        self.get_valid_response(self.org.slug, user.id, status_code=404)
