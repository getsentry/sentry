from unittest.mock import patch

from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature


class OrganizationSentryFunctions(APITestCase):
    method = "POST"
    endpoint = "sentry-api-0-organization-sentry-functions"

    def setUp(self):
        super().setUp()
        self.create_organization(owner=self.user, name="RowdyTiger")
        self.login_as(user=self.user)

    @patch("sentry.api.endpoints.organization_sentry_function.create_function")
    def test_post_feature_true(self, mock_func):
        defaultCode = "exports.yourFunction = (req, res) => {\n\tlet message = req.query.message || req.body.message || 'Hello World!';\n\tconsole.log('Query: ' + req.query);\n\tconsole.log('Body: ' + req.body);\n\tres.status(200).send(message);\n};"
        data = {
            "name": "foo",
            "author": "bar",
            "code": defaultCode,
            "overview": "qux",
        }
        with Feature("organizations:sentry-functions"):
            response = self.get_success_response(self.organization.slug, **data)
            assert response.status_code == 201
            assert response.data["name"] == "foo"
            assert response.data["author"] == "bar"
            assert response.data["code"] == defaultCode
            assert response.data["overview"] == "qux"
            mock_func.assert_called_once_with(defaultCode, response.data["external_id"], "qux")

    def test_post_missing_params(self):
        data = {"name": "foo", "overview": "qux"}
        with Feature("organizations:sentry-functions"):
            response = self.get_error_response(self.organization.slug, **data)
            assert response.status_code == 400

    def test_post_feature_false(self):
        data = {"name": "foo", "author": "bar"}
        response = self.get_error_response(self.organization.slug, **data)
        assert response.status_code == 404
