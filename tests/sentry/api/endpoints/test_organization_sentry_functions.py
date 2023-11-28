from __future__ import annotations

from typing import Any
from unittest.mock import patch
from uuid import uuid4

from sentry.models.sentryfunction import SentryFunction
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test


class OrganizationSentryFunctionBase(APITestCase):
    endpoint = "sentry-api-0-organization-sentry-functions"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.code = "exports.yourFunction = (req, res) => {\n\tlet message = req.query.message || req.body.message || 'Hello World!';\n\tconsole.log('Query: ' + req.query);\n\tconsole.log('Body: ' + req.body);\n\tres.status(200).send(message);\n};"
        self.data: dict[str, Any] = {
            "name": "foo",
            "author": "bar",
            "code": self.code,
            "overview": "qux",
        }


@region_silo_test
class OrganizationSentryFunctionsPost(OrganizationSentryFunctionBase):
    method = "POST"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.data["env_variables"] = [{"name": "foo", "value": "bar"}]

    @with_feature("organizations:sentry-functions")
    @patch("sentry.api.endpoints.organization_sentry_function.create_function")
    def test_post_feature_true(self, mock_func):
        response = self.get_success_response(self.organization.slug, status_code=201, **self.data)

        assert response.data == {
            "name": "foo",
            "slug": "foo",
            "author": "bar",
            "code": self.code,
            "overview": "qux",
            # skip checking external id because it has a random suffix
            "external_id": response.data["external_id"],
            "events": [],
            "env_variables": [{"name": "foo", "value": "bar"}],
        }

        mock_func.assert_called_once_with(
            self.code, response.data["external_id"], "qux", {"foo": "bar"}
        )

    @with_feature("organizations:sentry-functions")
    @patch("sentry.api.endpoints.organization_sentry_function.create_function")
    def test_generated_slug_not_entirely_numeric(self, mock_func):
        data = {**self.data, "name": "123"}
        response = self.get_success_response(self.organization.slug, status_code=201, **data)

        assert response.data["name"] == "123"
        assert response.data["author"] == "bar"
        assert response.data["code"] == self.code
        assert response.data["overview"] == "qux"

        slug = response.data["slug"]
        assert not slug.isdecimal()
        assert slug.startswith("123-")

        mock_func.assert_called_once_with(
            self.code, response.data["external_id"], "qux", {"foo": "bar"}
        )

    @with_feature("organizations:sentry-functions")
    def test_post_missing_params(self):
        data = {"name": "foo", "overview": "qux"}
        self.get_error_response(self.organization.slug, status_code=400, **data)

    def test_post_feature_false(self):
        data = {"name": "foo", "author": "bar"}
        response = self.get_error_response(self.organization.slug, status_code=404, **data)
        assert response.data == "organizations:sentry-functions flag set to false"


@region_silo_test
class OrganizationSentryFunctionsGet(OrganizationSentryFunctionBase):
    endpoint = "sentry-api-0-organization-sentry-functions"
    method = "GET"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.post_data = {
            **self.data,
            "slug": "foo",
            "organization_id": self.organization.id,
            "external_id": "foo-" + uuid4().hex,
        }

    @with_feature("organizations:sentry-functions")
    def test_get_empty(self):
        response = self.get_success_response(self.organization.slug, status_code=200)
        assert response.data == []

    @with_feature("organizations:sentry-functions")
    def test_get_with_function(self):
        SentryFunction.objects.create(**self.post_data)
        response = self.get_success_response(self.organization.slug, status_code=200)
        assert response.data[0] == {
            "name": "foo",
            "slug": "foo",
            "author": "bar",
            "code": self.code,
            "overview": "qux",
            "external_id": self.post_data["external_id"],
            "events": [],
            "env_variables": [],
        }

    @with_feature("organizations:sentry-functions")
    def test_get_with_function_and_env_variables(self):
        # env_variables is expected to be a single dict of key-value pairs if
        # you're directly creating a SentryFunction object using .create()
        SentryFunction.objects.create(**self.post_data, env_variables={"foo": "bar", "baz": "qux"})
        response = self.get_success_response(self.organization.slug, status_code=200)
        assert response.data[0] == {
            "name": "foo",
            "slug": "foo",
            "author": "bar",
            "code": self.code,
            "overview": "qux",
            "external_id": self.post_data["external_id"],
            "events": [],
            "env_variables": [{"name": "foo", "value": "bar"}, {"name": "baz", "value": "qux"}],
        }
