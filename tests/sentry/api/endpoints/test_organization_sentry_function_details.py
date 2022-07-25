from django.urls import reverse

from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature


class OrganizationSentryFunctionDetails(APITestCase):
    endpoint = "sentry-api-0-organization-sentry-function-details"

    def setUp(self):
        super().setUp()
        self.create_organization(owner=self.user, name="RowdyTiger")
        self.login_as(user=self.user)

    def test_get_valid_function(self):
        creation_endpoint = reverse(
            "sentry-api-0-organization-sentry-functions", args=[self.organization.slug]
        )
        with Feature("organizations:sentry-functions"):
            creation_response = self.client.post(
                creation_endpoint,
                data={"name": "foo", "author": "bar", "code": "baz", "overview": "qux"},
            )
            assert creation_response.status_code == 201
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

    def test_edit_valid_function(self):
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
                data={"name": "zoot!", "author": "bar", "code": "baz", "overview": "qux"},
            )
            assert edit_response.status_code == 201
            assert edit_response.data["name"] == "zoot!"
            assert creation_response.data["name"] != edit_response.data["name"]
            assert creation_response.data["author"] == edit_response.data["author"]
            assert creation_response.data["code"] == edit_response.data["code"]
            assert creation_response.data["overview"] == edit_response.data["overview"]

    def test_edit_invalid_function(self):
        edit_function_endpoint = reverse(
            self.endpoint, args=[self.organization.slug, "invalid-slug"]
        )
        edit_response = self.client.put(
            edit_function_endpoint,
            data={"name": "zoot!", "author": "bar", "code": "baz", "overview": "qux"},
        )
        assert edit_response.status_code == 404

    def test_delete_valid_function(self):
        creation_endpoint = reverse(
            "sentry-api-0-organization-sentry-functions", args=[self.organization.slug]
        )
        with Feature("organizations:sentry-functions"):
            creation_response = self.client.post(
                creation_endpoint,
                data={"name": "foo", "author": "bar", "code": "baz", "overview": "qux"},
            )
            assert creation_response.status_code == 201
            delete_function_endpoint = reverse(
                self.endpoint, args=[self.organization.slug, creation_response.data["slug"]]
            )
            delete_response = self.client.delete(delete_function_endpoint)
            assert delete_response.status_code == 204
            get_response = self.client.get(delete_function_endpoint)
            assert get_response.status_code == 404

    def test_delete_invalid_function(self):
        delete_function_endpoint = reverse(
            self.endpoint, args=[self.organization.slug, "invalid-slug"]
        )
        delete_response = self.client.delete(delete_function_endpoint)
        assert delete_response.status_code == 404
