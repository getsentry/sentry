from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature


class OrganizationSentryFunctions(APITestCase):
    method = "POST"
    endpoint = "sentry-api-0-organization-sentry-functions"

    def setUp(self):
        super().setUp()
        self.create_organization(owner=self.user, name="RowdyTiger")
        self.login_as(user=self.user)

    def test_post_feature_true(self):
        data = {"name": "foo", "author": "bar", "code": "baz", "overview": "qux"}
        with Feature("organizations:sentry-functions"):
            response = self.get_success_response(self.organization.slug, **data)
            assert response.status_code == 201
            assert response.data["name"] == "foo"
            assert response.data["author"] == "bar"
            assert response.data["code"] == "baz"
            assert response.data["overview"] == "qux"

    def test_post_feature_missing_params(self):
        data = {"name": "foo", "overview": "qux"}
        with Feature("organizations:sentry-functions"):
            response = self.get_error_response(self.organization.slug, **data)
            assert response.status_code == 400

    def test_post_feature_false(self):
        data = {"name": "foo", "author": "bar"}
        response = self.get_error_response(self.organization.slug, **data)
        assert response.status_code == 404
