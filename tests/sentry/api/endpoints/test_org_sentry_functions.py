from sentry.testutils import APITestCase


class OrganizationSentryFunctions(APITestCase):
    method = "POST"
    endpoint = "sentry-api-0-organization-sentry-functions"

    def setUp(self):
        super().setUp()
        self.create_organization(owner=self.user, name="RowdyTiger")
        self.login_as(user=self.user)

    def test_post(self):
        data = {"name": "foo", "author": "bar"}

        response = self.get_success_response(self.organization.slug, **data)
        assert response.status_code == 201
