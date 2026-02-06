from __future__ import annotations

import contextlib
from typing import TYPE_CHECKING, Any

import orjson
from django.test import override_settings
from django.urls import reverse

if TYPE_CHECKING:
    from rest_framework.response import _MonkeyPatchedResponse as Response

from sentry.scm.actions import SourceCodeManager
from sentry.scm.endpoints.scm_rpc import generate_request_signature, scm_method_registry
from sentry.testutils.cases import APITestCase


@contextlib.contextmanager
def add_say_hello():
    # Inject a test-only RPC method for cases that go beyond common arguments validation
    def say_hello(scm: SourceCodeManager, *, name: str) -> dict[str, str]:
        return {
            "message": f"Hello, {name}! You are from organization {scm.organization_id} and repository {scm.repository_id}."
        }

    assert "say_hello" not in scm_method_registry
    scm_method_registry["say_hello"] = say_hello
    try:
        yield
    finally:
        del scm_method_registry["say_hello"]


@override_settings(SCM_RPC_SHARED_SECRET=["a-long-value-that-is-hard-to-guess"])
class TestScmRpc(APITestCase):
    def call(self, method_name: str, data: dict[str, Any]) -> Response:
        path = reverse("sentry-api-0-scm-rpc-service", kwargs={"method_name": method_name})
        return self.client.post(
            path,
            data=data,
            HTTP_AUTHORIZATION=f"rpcsignature {generate_request_signature(path, orjson.dumps(data))}",
        )

    def test_simplest_success(self) -> None:
        with add_say_hello():
            response = self.call(
                "say_hello",
                {"args": {"name": "World", "organization_id": 42, "repository_id": 57}, "meta": {}},
            )
            assert response.status_code == 200
            assert response.json() == {
                "message": "Hello, World! You are from organization 42 and repository 57."
            }

    def test_no_authorization_header(self) -> None:
        path = reverse("sentry-api-0-scm-rpc-service", kwargs={"method_name": "say_hello"})
        data = {"args": {"name": "World", "organization_id": 42, "repository_id": 57}}
        response = self.client.post(path, data=data)
        assert response.status_code == 403
        assert response.json() == {"detail": "You do not have permission to perform this action."}

    def test_wrong_name_in_authorization_header(self) -> None:
        path = reverse("sentry-api-0-scm-rpc-service", kwargs={"method_name": "say_hello"})
        data = {"args": {"name": "World", "organization_id": 42, "repository_id": 57}}
        response = self.client.post(
            path,
            data=data,
            HTTP_AUTHORIZATION=f"not_rpcsignature {generate_request_signature(path, orjson.dumps(data))}",
        )
        assert response.status_code == 403
        assert response.json() == {"detail": "You do not have permission to perform this action."}

    def test_wrong_signature_version_in_authorization_header(self) -> None:
        path = reverse("sentry-api-0-scm-rpc-service", kwargs={"method_name": "say_hello"})
        data = {"args": {"name": "World", "organization_id": 42, "repository_id": 57}}
        response = self.client.post(path, data=data, HTTP_AUTHORIZATION="rpcsignature rpc42:foobar")
        assert response.status_code == 401
        assert response.json() == {
            "detail": "SCM RPC signature validation failed: invalid signature prefix"
        }

    def test_wrong_signature_in_authorization_header(self) -> None:
        path = reverse("sentry-api-0-scm-rpc-service", kwargs={"method_name": "say_hello"})
        data = {"args": {"name": "World", "organization_id": 42, "repository_id": 57}}
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION="rpcsignature rpc0:wrong-signature"
        )
        assert response.status_code == 401
        assert response.json() == {"detail": "SCM RPC signature validation failed: wrong secret"}

    def test_signature_with_more_colons_in_authorization_header(self) -> None:
        path = reverse("sentry-api-0-scm-rpc-service", kwargs={"method_name": "say_hello"})
        data = {"args": {"name": "World", "organization_id": 42, "repository_id": 57}}
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION="rpcsignature rpc0:signature:with:colons"
        )
        assert response.status_code == 401
        assert response.json() == {"detail": "SCM RPC signature validation failed: wrong secret"}

    def test_signature_without_prefix_in_authorization_header(self) -> None:
        path = reverse("sentry-api-0-scm-rpc-service", kwargs={"method_name": "say_hello"})
        data = {"args": {"name": "World", "organization_id": 42, "repository_id": 57}}
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION="rpcsignature signature-without-prefix"
        )
        assert response.status_code == 401
        assert response.json() == {
            "detail": "SCM RPC signature validation failed: invalid signature format"
        }

    def test_invalid_endpoint(self) -> None:
        response = self.call("not_a_method", {"args": {}})
        assert response.status_code == 404
        assert response.json() == {"detail": "Unknown RPC method 'not_a_method'"}

    organization_id_error_message = "Argument 'organization_id' must be an integer"

    def test_no_organization_id(self) -> None:
        response = self.call("get_issue_comments", {"args": {"repository_id": 57}, "meta": {}})
        assert response.status_code == 400
        assert response.json() == [self.organization_id_error_message]

    def test_string_as_organization_id(self) -> None:
        response = self.call(
            "get_issue_comments",
            {"args": {"organization_id": "invalid", "repository_id": 57}, "meta": {}},
        )
        assert response.status_code == 400
        assert response.json() == [self.organization_id_error_message]

    repository_id_error_message = 'Argument \'repository_id\' must be an integer or a dict {"provider": string, "external_id": string}'

    def test_no_repository_id(self) -> None:
        response = self.call("get_issue_comments", {"args": {"organization_id": 42}, "meta": {}})
        assert response.status_code == 400
        assert response.json() == [self.repository_id_error_message]

    def test_string_as_repository_id(self) -> None:
        response = self.call(
            "get_issue_comments",
            {"args": {"organization_id": 42, "repository_id": "invalid"}, "meta": {}},
        )
        assert response.status_code == 400
        assert response.json() == [self.repository_id_error_message]

    def test_dict_with_missing_provider_as_repository_id(self) -> None:
        response = self.call(
            "get_issue_comments",
            {
                "args": {"organization_id": 42, "repository_id": {"external_id": "repo1"}},
                "meta": {},
            },
        )
        assert response.status_code == 400
        assert response.json() == [self.repository_id_error_message]

    def test_dict_with_missing_external_id_as_repository_id(self) -> None:
        response = self.call(
            "get_issue_comments",
            {"args": {"organization_id": 42, "repository_id": {"provider": "github"}}, "meta": {}},
        )
        assert response.status_code == 400
        assert response.json() == [self.repository_id_error_message]

    def test_dict_with_extra_attribute_as_repository_id(self) -> None:
        response = self.call(
            "get_issue_comments",
            {
                "args": {
                    "organization_id": 42,
                    "repository_id": {
                        "provider": "github",
                        "external_id": "repo1",
                        "extra": "value",
                    },
                },
                "meta": {},
            },
        )
        assert response.status_code == 400
        assert response.json() == [self.repository_id_error_message]

    def test_correct_dict_as_repository_id(self) -> None:
        with add_say_hello():
            response = self.call(
                "say_hello",
                {
                    "args": {
                        "name": "Vincent",
                        "organization_id": 57,
                        "repository_id": {"provider": "github", "external_id": "repo1"},
                    },
                    "meta": {},
                },
            )
            assert response.status_code == 200
            assert response.json() == {
                "message": "Hello, Vincent! You are from organization 57 and repository ('github', 'repo1')."
            }

    def test_missing_method_argument(self) -> None:
        with add_say_hello():
            response = self.call(
                "say_hello", {"args": {"organization_id": 42, "repository_id": 57}, "meta": {}}
            )
            assert response.status_code == 400
            assert response.json() == [
                "Error calling method say_hello: add_say_hello.<locals>.say_hello() missing 1 required keyword-only argument: 'name'"
            ]

    def test_extra_method_argument(self) -> None:
        with add_say_hello():
            response = self.call(
                "say_hello",
                {
                    "args": {
                        "organization_id": 42,
                        "repository_id": 57,
                        "name": "World",
                        "login": "jacquev6",
                    },
                    "meta": {},
                },
            )
            assert response.status_code == 400
            assert response.json() == [
                "Error calling method say_hello: add_say_hello.<locals>.say_hello() got an unexpected keyword argument 'login'"
            ]

    def test_misspelled_method_argument(self) -> None:
        with add_say_hello():
            response = self.call(
                "say_hello",
                {"args": {"organization_id": 42, "repository_id": 57, "fame": "World"}, "meta": {}},
            )
            assert response.status_code == 400
            assert response.json() == [
                "Error calling method say_hello: add_say_hello.<locals>.say_hello() got an unexpected keyword argument 'fame'. Did you mean 'name'?"
            ]
