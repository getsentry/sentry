from __future__ import annotations

import contextlib
from typing import TYPE_CHECKING, Any

import orjson
from django.test import override_settings
from django.urls import reverse

if TYPE_CHECKING:
    from rest_framework.response import _MonkeyPatchedResponse as Response

from sentry.constants import ObjectStatus
from sentry.models.repository import Repository
from sentry.scm.actions import SourceCodeManager
from sentry.scm.endpoints.scm_rpc import generate_request_signature
from sentry.scm.errors import SCMCodedError, SCMError, SCMProviderException, SCMUnhandledException
from sentry.scm.private.rpc import scm_action_registry
from sentry.testutils.cases import APITestCase


@contextlib.contextmanager
def add_method(method_name: str, method_fn: Any):
    # Inject a test-only RPC method for cases that go beyond common arguments validation
    assert method_name not in scm_action_registry
    scm_action_registry[method_name] = method_fn
    try:
        yield
    finally:
        del scm_action_registry[method_name]


@contextlib.contextmanager
def add_say_hello():
    def say_hello(scm: SourceCodeManager, *, name: str) -> dict[str, str]:
        return {
            "message": f"Hello, {name}! You are from organization {scm.provider.repository['organization_id']} and repository {scm.provider.repository['name']}."
        }

    with add_method("say_hello", say_hello):
        yield


@contextlib.contextmanager
def add_raise_scm_error(error: SCMError):
    def raise_scm_error(scm: SourceCodeManager) -> dict[str, str]:
        raise error

    with add_method("raise_scm_error", raise_scm_error):
        yield


@contextlib.contextmanager
def add_call_missing_provider_method():
    def call_missing_provider_method(scm: SourceCodeManager) -> None:
        scm.this_method_does_not_exist()  # type: ignore[attr-defined]

    with add_method("call_missing_provider_method", call_missing_provider_method):
        yield


@override_settings(SCM_RPC_SHARED_SECRET=["a-long-value-that-is-hard-to-guess"])
class TestScmRpc(APITestCase):
    def setUp(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github Test Org",
            external_id="1",
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="integrations:github",
            external_id="12345",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

    def call(self, method_name: str, data: Any) -> Response:
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
                {
                    "args": {
                        "name": "World",
                        "organization_id": self.organization.id,
                        "repository_id": self.repo.id,
                    },
                    "meta": {},
                },
            )
            assert response.status_code == 200, response.json()
            assert response.json() == {
                "data": {
                    "message": f"Hello, World! You are from organization {self.organization.id} and repository test-org/test-repo."
                }
            }

    def test_no_authorization_header(self) -> None:
        path = reverse("sentry-api-0-scm-rpc-service", kwargs={"method_name": "say_hello"})
        data = {
            "args": {
                "name": "World",
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
            }
        }
        response = self.client.post(path, data=data)
        assert response.status_code == 403
        # Response body is built by DRF before we can format it as {"errors": [{"detail": ...}]}
        assert response.json() == {"detail": "You do not have permission to perform this action."}

    def test_wrong_name_in_authorization_header(self) -> None:
        path = reverse("sentry-api-0-scm-rpc-service", kwargs={"method_name": "say_hello"})
        data = {
            "args": {
                "name": "World",
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
            }
        }
        response = self.client.post(
            path,
            data=data,
            HTTP_AUTHORIZATION=f"not_rpcsignature {generate_request_signature(path, orjson.dumps(data))}",
        )
        assert response.status_code == 403
        assert response.json() == {"detail": "You do not have permission to perform this action."}

    def test_wrong_signature_version_in_authorization_header(self) -> None:
        path = reverse("sentry-api-0-scm-rpc-service", kwargs={"method_name": "say_hello"})
        data = {
            "args": {
                "name": "World",
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
            }
        }
        response = self.client.post(path, data=data, HTTP_AUTHORIZATION="rpcsignature rpc42:foobar")
        assert response.status_code == 401
        assert response.json() == {
            "errors": [
                {
                    "status": "401",
                    "title": "SCM RPC signature validation failed.",
                    "detail": "invalid signature prefix",
                    "meta": {"exception_type": "AuthenticationFailure"},
                }
            ]
        }

    def test_wrong_signature_in_authorization_header(self) -> None:
        path = reverse("sentry-api-0-scm-rpc-service", kwargs={"method_name": "say_hello"})
        data = {
            "args": {
                "name": "World",
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
            }
        }
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION="rpcsignature rpc0:wrong-signature"
        )
        assert response.status_code == 401
        assert response.json() == {
            "errors": [
                {
                    "status": "401",
                    "title": "SCM RPC signature validation failed.",
                    "detail": "wrong secret",
                    "meta": {"exception_type": "AuthenticationFailure"},
                }
            ]
        }

    def test_signature_with_more_colons_in_authorization_header(self) -> None:
        path = reverse("sentry-api-0-scm-rpc-service", kwargs={"method_name": "say_hello"})
        data = {
            "args": {
                "name": "World",
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
            }
        }
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION="rpcsignature rpc0:signature:with:colons"
        )
        assert response.status_code == 401
        assert response.json() == {
            "errors": [
                {
                    "status": "401",
                    "title": "SCM RPC signature validation failed.",
                    "detail": "wrong secret",
                    "meta": {"exception_type": "AuthenticationFailure"},
                }
            ]
        }

    def test_signature_without_prefix_in_authorization_header(self) -> None:
        path = reverse("sentry-api-0-scm-rpc-service", kwargs={"method_name": "say_hello"})
        data = {
            "args": {
                "name": "World",
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
            }
        }
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION="rpcsignature signature-without-prefix"
        )
        assert response.status_code == 401
        assert response.json() == {
            "errors": [
                {
                    "status": "401",
                    "title": "SCM RPC signature validation failed.",
                    "detail": "invalid signature format",
                    "meta": {"exception_type": "AuthenticationFailure"},
                }
            ]
        }

    def test_invalid_endpoint(self) -> None:
        response = self.call("not_a_method", {"args": {}})
        assert response.status_code == 404
        assert response.json() == {
            "errors": [
                {
                    "meta": {
                        "exception_type": "SCMRpcActionNotFound",
                        "action_name": "not_a_method",
                    },
                    "status": "404",
                    "title": "Not found",
                    "detail": "Could not find action not_a_method",
                }
            ]
        }

    def test_no_organization_id(self) -> None:
        response = self.call("get_issue_comments_v1", {"args": {"repository_id": 57}, "meta": {}})
        assert response.status_code == 400
        assert response.json() == {
            "errors": [
                {
                    "status": "400",
                    "title": "The request could not be deserialized.",
                    "meta": {
                        "exception_type": "SCMRpcCouldNotDeserializeRequest",
                        "loc": ["args", "organization_id"],
                        "msg": "field required",
                        "type": "value_error.missing",
                    },
                }
            ]
        }

    def test_string_as_organization_id(self) -> None:
        response = self.call(
            "get_issue_comments_v1",
            {"args": {"organization_id": "invalid", "repository_id": 57}, "meta": {}},
        )
        assert response.status_code == 400
        assert response.json() == {
            "errors": [
                {
                    "status": "400",
                    "title": "The request could not be deserialized.",
                    "meta": {
                        "loc": ["args", "organization_id"],
                        "msg": "value is not a valid integer",
                        "type": "type_error.integer",
                        "exception_type": "SCMRpcCouldNotDeserializeRequest",
                    },
                }
            ]
        }

    def test_no_repository_id(self) -> None:
        response = self.call("get_issue_comments_v1", {"args": {"organization_id": 42}, "meta": {}})
        assert response.status_code == 400
        assert response.json() == {
            "errors": [
                {
                    "status": "400",
                    "title": "The request could not be deserialized.",
                    "meta": {
                        "loc": ["args", "repository_id"],
                        "msg": "field required",
                        "type": "value_error.missing",
                        "exception_type": "SCMRpcCouldNotDeserializeRequest",
                    },
                }
            ]
        }

    def test_string_as_repository_id(self) -> None:
        response = self.call(
            "get_issue_comments_v1",
            {"args": {"organization_id": 42, "repository_id": "invalid"}, "meta": {}},
        )
        assert response.status_code == 400
        assert response.json() == {
            "errors": [
                {
                    "status": "400",
                    "title": "The request could not be deserialized.",
                    "meta": {
                        "loc": ["args", "repository_id"],
                        "msg": "value is not a valid integer",
                        "type": "type_error.integer",
                        "exception_type": "SCMRpcCouldNotDeserializeRequest",
                    },
                },
                {
                    "status": "400",
                    "title": "The request could not be deserialized.",
                    "meta": {
                        "loc": ["args", "repository_id"],
                        "msg": "value is not a valid dict",
                        "type": "type_error.dict",
                        "exception_type": "SCMRpcCouldNotDeserializeRequest",
                    },
                },
            ]
        }

    def test_dict_with_missing_provider_as_repository_id(self) -> None:
        response = self.call(
            "get_issue_comments_v1",
            {
                "args": {"organization_id": 42, "repository_id": {"external_id": "repo1"}},
                "meta": {},
            },
        )
        assert response.status_code == 400
        assert response.json() == {
            "errors": [
                {
                    "status": "400",
                    "title": "The request could not be deserialized.",
                    "meta": {
                        "loc": ["args", "repository_id"],
                        "msg": "value is not a valid integer",
                        "type": "type_error.integer",
                        "exception_type": "SCMRpcCouldNotDeserializeRequest",
                    },
                },
                {
                    "status": "400",
                    "title": "The request could not be deserialized.",
                    "meta": {
                        "loc": ["args", "repository_id", "provider"],
                        "msg": "field required",
                        "type": "value_error.missing",
                        "exception_type": "SCMRpcCouldNotDeserializeRequest",
                    },
                },
            ]
        }

    def test_dict_with_missing_external_id_as_repository_id(self) -> None:
        response = self.call(
            "get_issue_comments_v1",
            {"args": {"organization_id": 42, "repository_id": {"provider": "github"}}, "meta": {}},
        )
        assert response.status_code == 400
        assert response.json() == {
            "errors": [
                {
                    "status": "400",
                    "title": "The request could not be deserialized.",
                    "meta": {
                        "loc": ["args", "repository_id"],
                        "msg": "value is not a valid integer",
                        "type": "type_error.integer",
                        "exception_type": "SCMRpcCouldNotDeserializeRequest",
                    },
                },
                {
                    "status": "400",
                    "title": "The request could not be deserialized.",
                    "meta": {
                        "loc": ["args", "repository_id", "external_id"],
                        "msg": "field required",
                        "type": "value_error.missing",
                        "exception_type": "SCMRpcCouldNotDeserializeRequest",
                    },
                },
            ]
        }

    def test_dict_with_extra_attribute_as_repository_id(self) -> None:
        response = self.call(
            "get_issue_comments_v1",
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
        assert response.json() == {
            "errors": [
                {
                    "status": "400",
                    "title": "The request could not be deserialized.",
                    "meta": {
                        "loc": ["args", "repository_id"],
                        "msg": "value is not a valid integer",
                        "type": "type_error.integer",
                        "exception_type": "SCMRpcCouldNotDeserializeRequest",
                    },
                },
                {
                    "status": "400",
                    "title": "The request could not be deserialized.",
                    "meta": {
                        "loc": ["args", "repository_id", "extra"],
                        "msg": "extra fields not permitted",
                        "type": "value_error.extra",
                        "exception_type": "SCMRpcCouldNotDeserializeRequest",
                    },
                },
            ]
        }

    def test_correct_dict_as_repository_id(self) -> None:
        with add_say_hello():
            response = self.call(
                "say_hello",
                {
                    "args": {
                        "name": "Vincent",
                        "organization_id": self.organization.id,
                        "repository_id": {"provider": "github", "external_id": "12345"},
                    },
                    "meta": {},
                },
            )
            assert response.status_code == 200
            assert response.json() == {
                "data": {
                    "message": f"Hello, Vincent! You are from organization {self.organization.id} and repository test-org/test-repo."
                }
            }

    def test_missing_method_argument(self) -> None:
        with add_say_hello():
            response = self.call(
                "say_hello",
                {
                    "args": {
                        "organization_id": self.organization.id,
                        "repository_id": self.repo.id,
                    },
                    "meta": {},
                },
            )
            assert response.status_code == 500
            assert response.json() == {
                "errors": [
                    {
                        "status": "500",
                        "title": "An unexpected error occurred.",
                        "detail": "Error calling method say_hello: add_say_hello.<locals>.say_hello() missing 1 required keyword-only argument: 'name'",
                        "meta": {
                            "exception_type": "SCMRpcActionCallError",
                            "action_name": "say_hello",
                            "message": "Error calling method say_hello: add_say_hello.<locals>.say_hello() missing 1 required keyword-only argument: 'name'",
                        },
                    }
                ]
            }

    def test_extra_method_argument(self) -> None:
        with add_say_hello():
            response = self.call(
                "say_hello",
                {
                    "args": {
                        "organization_id": self.organization.id,
                        "repository_id": self.repo.id,
                        "name": "World",
                        "login": "jacquev6",
                    },
                    "meta": {},
                },
            )
            assert response.status_code == 500
            assert response.json() == {
                "errors": [
                    {
                        "status": "500",
                        "title": "An unexpected error occurred.",
                        "detail": "Error calling method say_hello: add_say_hello.<locals>.say_hello() got an unexpected keyword argument 'login'",
                        "meta": {
                            "exception_type": "SCMRpcActionCallError",
                            "action_name": "say_hello",
                            "message": "Error calling method say_hello: add_say_hello.<locals>.say_hello() got an unexpected keyword argument 'login'",
                        },
                    }
                ]
            }

    def test_misspelled_method_argument(self) -> None:
        with add_say_hello():
            response = self.call(
                "say_hello",
                {
                    "args": {
                        "organization_id": self.organization.id,
                        "repository_id": self.repo.id,
                        "fame": "World",
                    },
                    "meta": {},
                },
            )
            assert response.status_code == 500
            assert response.json() == {
                "errors": [
                    {
                        "status": "500",
                        "title": "An unexpected error occurred.",
                        "detail": "Error calling method say_hello: add_say_hello.<locals>.say_hello() got an unexpected keyword argument 'fame'. Did you mean 'name'?",
                        "meta": {
                            "exception_type": "SCMRpcActionCallError",
                            "action_name": "say_hello",
                            "message": "Error calling method say_hello: add_say_hello.<locals>.say_hello() got an unexpected keyword argument 'fame'. Did you mean 'name'?",
                        },
                    }
                ]
            }

    def test_list_as_data(self) -> None:
        with add_say_hello():
            response = self.call("say_hello", [])
            assert response.status_code == 400
            assert response.json() == {
                "errors": [
                    {
                        "status": "400",
                        "title": "The request could not be deserialized.",
                        "meta": {
                            "exception_type": "SCMRpcCouldNotDeserializeRequest",
                            "loc": ["args"],
                            "msg": "field required",
                            "type": "value_error.missing",
                        },
                    }
                ]
            }

    def test_empty_dict_as_data(self) -> None:
        with add_say_hello():
            response = self.call("say_hello", {})
            assert response.status_code == 400
            assert response.json() == {
                "errors": [
                    {
                        "status": "400",
                        "title": "The request could not be deserialized.",
                        "meta": {
                            "exception_type": "SCMRpcCouldNotDeserializeRequest",
                            "loc": ["args"],
                            "msg": "field required",
                            "type": "value_error.missing",
                        },
                    }
                ]
            }

    def test_list_as_args(self) -> None:
        with add_say_hello():
            response = self.call("say_hello", {"args": []})
            assert response.status_code == 400
            assert response.json() == {
                "errors": [
                    {
                        "status": "400",
                        "title": "The request could not be deserialized.",
                        "meta": {
                            "exception_type": "SCMRpcCouldNotDeserializeRequest",
                            "loc": ["args", "organization_id"],
                            "msg": "field required",
                            "type": "value_error.missing",
                        },
                    },
                    {
                        "status": "400",
                        "title": "The request could not be deserialized.",
                        "meta": {
                            "exception_type": "SCMRpcCouldNotDeserializeRequest",
                            "loc": ["args", "repository_id"],
                            "msg": "field required",
                            "type": "value_error.missing",
                        },
                    },
                ]
            }

    def test_scm_unhandled_exception_in_provider_method(self) -> None:
        with add_raise_scm_error(SCMUnhandledException("Blah", 68)):
            response = self.call(
                "raise_scm_error",
                {"args": {"organization_id": self.organization.id, "repository_id": self.repo.id}},
            )
            assert response.status_code == 500
            assert response.json() == {
                "errors": [
                    {
                        "status": "500",
                        "title": "An unexpected error occurred.",
                        "detail": "Blah, 68",
                        "meta": {"exception_type": "SCMUnhandledException"},
                    }
                ]
            }

    def test_scm_coded_error_in_provider_method(self) -> None:
        with add_raise_scm_error(SCMCodedError("Blah", 68, code="repository_not_found")):
            response = self.call(
                "raise_scm_error",
                {"args": {"organization_id": self.organization.id, "repository_id": self.repo.id}},
            )
            assert response.status_code == 500
            assert response.json() == {
                "errors": [
                    {
                        "status": "500",
                        "title": "An error occurred.",
                        "detail": "repository_not_found, A repository could not be found., Blah, 68",
                        "meta": {"exception_type": "SCMCodedError", "code": "repository_not_found"},
                    }
                ]
            }

    def test_scm_error_in_provider_method(self) -> None:
        with add_raise_scm_error(SCMError("Blah", 42)):
            response = self.call(
                "raise_scm_error",
                {"args": {"organization_id": self.organization.id, "repository_id": self.repo.id}},
            )
            assert response.status_code == 500
            assert response.json() == {
                "errors": [
                    {
                        "status": "500",
                        "title": "An unexpected error occurred.",
                        "detail": "Blah, 42",
                        "meta": {"exception_type": "SCMError"},
                    }
                ]
            }

    def test_attribute_error_in_provider_method_is_treated_as_provider_not_supported(self) -> None:
        with add_call_missing_provider_method():
            response = self.call(
                "call_missing_provider_method",
                {"args": {"organization_id": self.organization.id, "repository_id": self.repo.id}},
            )

        assert response.status_code == 400
        assert response.json() == {
            "errors": [
                {
                    "status": "400",
                    "title": "Provider not supported.",
                    "detail": "call_missing_provider_method is not supported by service-provider GitHubProvider",
                    "meta": {"exception_type": "SCMProviderNotSupported"},
                }
            ]
        }

    def test_scm_provider_exception_in_provider_method(self) -> None:
        with add_raise_scm_error(SCMProviderException("Blah", 68)):
            response = self.call(
                "raise_scm_error",
                {"args": {"organization_id": self.organization.id, "repository_id": self.repo.id}},
            )
            assert response.status_code == 503
            assert response.json() == {
                "errors": [
                    {
                        "status": "503",
                        "title": "The service provider raised an error.",
                        "detail": "Blah, 68",
                        "meta": {"exception_type": "SCMProviderException"},
                    }
                ]
            }
