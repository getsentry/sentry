from sentry.testutils import APITestCase


class UserOrganizationsTest(APITestCase):
    endpoint = "sentry-api-0-user-organizations"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        organization_id = self.organization.id  # force creation

        response = self.get_valid_response("me")
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(organization_id)
