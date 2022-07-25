from unittest.mock import patch

from django.urls import reverse

from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature


class OrganizationSentryFunctionDetails(APITestCase):
    endpoint = "sentry-api-0-organization-sentry-function-details"

    def setUp(self):
        super().setUp()
        self.create_organization(owner=self.user, name="RowdyTiger")
        self.login_as(user=self.user)

    @patch("sentry.api.endpoints.organization_sentry_function.create_function")
    def test_get_valid_function(self, mock_func):
        creation_endpoint = reverse(
            "sentry-api-0-organization-sentry-functions", args=[self.organization.slug]
        )
        with Feature("organizations:sentry-functions"):
            creation_response = self.client.post(
                creation_endpoint,
                data={"name": "foo", "author": "bar", "code": "baz", "overview": "qux"},
            )
            assert creation_response.status_code == 201
            mock_func.assert_called_once_with("baz", creation_response.data["external_id"], "qux")
            get_function_endpoint = reverse(
                self.endpoint, args=[self.organization.slug, creation_response.data["slug"]]
            )
            get_response = self.client.get(get_function_endpoint)
            assert get_response.status_code == 200
            assert creation_response.data == get_response.data

    def test_get_invalid_function(self):
        get_function_endpoint = reverse(
            self.endpoint, args=[self.organization.slug, "invalid-slug"]
        )
        get_response = self.client.get(get_function_endpoint)
        assert get_response.status_code == 404

    @patch("sentry.api.endpoints.organization_sentry_function.create_function")
    @patch("sentry.api.endpoints.organization_sentry_function_details.update_function")
    def test_edit_valid_function(self, mock_update_func, mock_create_func):
        creation_endpoint = reverse(
            "sentry-api-0-organization-sentry-functions", args=[self.organization.slug]
        )
        with Feature("organizations:sentry-functions"):
            creation_response = self.client.post(
                creation_endpoint,
                data={"name": "foo", "author": "bar", "code": "baz", "overview": "qux"},
            )
            assert creation_response.status_code == 201
            edit_function_endpoint = reverse(
                self.endpoint, args=[self.organization.slug, creation_response.data["slug"]]
            )
            edit_response = self.client.put(
                edit_function_endpoint,
                data={"name": "foo", "author": "bar", "code": "newEditedCode", "overview": "qux"},
            )
            assert edit_response.status_code == 201
            assert creation_response.data["name"] == edit_response.data["name"]
            assert creation_response.data["author"] == edit_response.data["author"]
            assert creation_response.data["code"] != edit_response.data["code"]
            assert creation_response.data["overview"] == edit_response.data["overview"]
            mock_create_func.assert_called_once_with(
                "baz", creation_response.data["external_id"], "qux"
            )
            mock_update_func.assert_called_once_with(
                "newEditedCode", creation_response.data["external_id"], "qux"
            )

    def test_edit_invalid_function(self):
        edit_function_endpoint = reverse(
            self.endpoint, args=[self.organization.slug, "invalid-slug"]
        )
        edit_response = self.client.put(
            edit_function_endpoint,
            data={"name": "zoot!", "author": "bar", "code": "baz", "overview": "qux"},
        )
        assert edit_response.status_code == 404

    @patch("sentry.api.endpoints.organization_sentry_function_details.delete_function")
    @patch("sentry.api.endpoints.organization_sentry_function.create_function")
    def test_delete_valid_function(self, mock_create_func, mock_delete_func):
        creation_endpoint = reverse(
            "sentry-api-0-organization-sentry-functions", args=[self.organization.slug]
        )
        with Feature("organizations:sentry-functions"):
            creation_response = self.client.post(
                creation_endpoint,
                data={"name": "foo", "author": "bar", "code": "baz", "overview": "qux"},
            )
            delete_function_endpoint = reverse(
                self.endpoint, args=[self.organization.slug, creation_response.data["slug"]]
            )
            delete_response = self.client.delete(delete_function_endpoint)
            get_response = self.client.get(delete_function_endpoint)
            assert creation_response.status_code == 201
            assert delete_response.status_code == 204
            assert get_response.status_code == 404
            mock_create_func.assert_called_once_with(
                "baz", creation_response.data["external_id"], "qux"
            )
            mock_delete_func.assert_called_once_with(creation_response.data["external_id"])

    def test_delete_invalid_function(self):
        delete_function_endpoint = reverse(
            self.endpoint, args=[self.organization.slug, "invalid-slug"]
        )
        delete_response = self.client.delete(delete_function_endpoint)
        assert delete_response.status_code == 404
