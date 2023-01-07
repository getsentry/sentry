from unittest.mock import patch

from django.urls import reverse

from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class OrganizationSentryFunctions(APITestCase):
    endpoint = "sentry-api-0-organization-sentry-functions"

    def setUp(self):
        super().setUp()
        self.create_organization(owner=self.user, name="RowdyTiger")
        self.url = reverse(self.endpoint, args=[self.organization.slug])
        self.login_as(user=self.user)

    @patch("sentry.api.endpoints.organization_sentry_function.create_function")
    def test_post_feature_true(self, mock_func):
        defaultCode = "exports.yourFunction = (req, res) => {\n\tlet message = req.query.message || req.body.message || 'Hello World!';\n\tconsole.log('Query: ' + req.query);\n\tconsole.log('Body: ' + req.body);\n\tres.status(200).send(message);\n};"
        data = {
            "name": "foo",
            "author": "bar",
            "code": defaultCode,
            "overview": "qux",
            "envVariables": [{"name": "foo", "value": "bar"}],
        }
        with Feature("organizations:sentry-functions"):
            response = self.client.post(self.url, data)
            assert response.status_code == 201
            assert response.data["name"] == "foo"
            assert response.data["author"] == "bar"
            assert response.data["code"] == defaultCode
            assert response.data["overview"] == "qux"
            mock_func.assert_called_once_with(
                defaultCode, response.data["external_id"], "qux", {"foo": "bar"}
            )

    def test_post_missing_params(self):
        data = {"name": "foo", "overview": "qux"}
        with Feature("organizations:sentry-functions"):
            response = self.client.post(self.url, **data)
            assert response.status_code == 400

    def test_post_feature_false(self):
        data = {"name": "foo", "author": "bar"}
        response = self.client.post(self.url, **data)
        assert response.status_code == 404

    def test_get(self):
        with Feature("organizations:sentry-functions"):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert response.data == []

    @patch("sentry.api.endpoints.organization_sentry_function.create_function")
    def test_get_with_function(self, mock_func):
        defaultCode = "exports.yourFunction = (req, res) => {\n\tlet message = req.query.message || req.body.message || 'Hello World!';\n\tconsole.log('Query: ' + req.query);\n\tconsole.log('Body: ' + req.body);\n\tres.status(200).send(message);\n};"
        data = {
            "name": "foo",
            "author": "bar",
            "code": defaultCode,
            "overview": "qux",
            "envVariables": [{"name": "foo", "value": "bar"}],
        }
        with Feature("organizations:sentry-functions"):
            self.client.post(self.url, data)
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert response.data[0]["name"] == "foo"
            assert response.data[0]["author"] == "bar"
            assert response.data[0]["code"] == defaultCode
            assert response.data[0]["overview"] == "qux"
            mock_func.assert_called_once_with(
                defaultCode, response.data[0]["external_id"], "qux", {"foo": "bar"}
            )
