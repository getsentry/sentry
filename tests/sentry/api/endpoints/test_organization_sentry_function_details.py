from unittest.mock import patch

from django.urls import reverse

from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature


class OrganizationSentryFunctionDetails(APITestCase):
    endpoint = "sentry-api-0-organization-sentry-function-details"

    @patch("sentry.api.endpoints.organization_sentry_function.create_function")
    def setUp(self, mock_func):
        super().setUp()
        self.create_organization(owner=self.user, name="RowdyTiger")
        self.login_as(user=self.user)
        self.creation_endpoint = reverse(
            "sentry-api-0-organization-sentry-functions", args=[self.organization.slug]
        )
        with Feature("organizations:sentry-functions"):
            self.creation_response = self.client.post(
                self.creation_endpoint,
                data={"name": "foo", "author": "bar", "code": "baz", "overview": "qux"},
            )

    def test_get_valid_function(self):
        with Feature("organizations:sentry-functions"):
            get_function_endpoint = reverse(self.endpoint, args=[self.organization.slug, "foo"])
            print(get_function_endpoint)
            get_response = self.client.get(get_function_endpoint)
            assert get_response.status_code == 200
            assert get_response.data["name"] == "foo"
            assert get_response.data["author"] == "bar"
            assert get_response.data["code"] == "baz"
            assert get_response.data["overview"] == "qux"

    def test_get_invalid_function(self):
        get_function_endpoint = reverse(
            self.endpoint, args=[self.organization.slug, "invalid-slug"]
        )
        get_response = self.client.get(get_function_endpoint)
        assert get_response.status_code == 404

    @patch("sentry.api.endpoints.organization_sentry_function_details.update_function")
    def test_edit_valid_function(self, mock_update_func):
        with Feature("organizations:sentry-functions"):
            edit_function_endpoint = reverse(
                self.endpoint, args=[self.organization.slug, self.creation_response.data["slug"]]
            )
            edit_response = self.client.put(
                edit_function_endpoint,
                data={"name": "foo", "author": "bar", "code": "newEditedCode", "overview": "qux"},
            )
            assert edit_response.status_code == 201
            assert edit_response.data["name"] == "foo"
            assert edit_response.data["code"] == "newEditedCode"
            assert edit_response.data["overview"] == "qux"
            assert edit_response.data["author"] == "bar"
            mock_update_func.assert_called_once_with(
                "newEditedCode", self.creation_response.data["external_id"], "qux"
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
    def test_delete_valid_function(self, mock_delete_func):
        with Feature("organizations:sentry-functions"):
            print(self.creation_endpoint)
            delete_function_endpoint = reverse(
                self.endpoint, args=[self.organization.slug, self.creation_response.data["slug"]]
            )
            print(delete_function_endpoint)
            delete_response = self.client.delete(delete_function_endpoint)
            get_response = self.client.get(delete_function_endpoint)
            assert delete_response.status_code == 204
            assert get_response.status_code == 404
            mock_delete_func.assert_called_once_with(self.creation_response.data["external_id"])

    def test_delete_invalid_function(self):
        delete_function_endpoint = reverse(
            self.endpoint, args=[self.organization.slug, "invalid-slug"]
        )
        delete_response = self.client.delete(delete_function_endpoint)
        assert delete_response.status_code == 404
