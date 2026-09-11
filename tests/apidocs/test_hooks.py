import os
from typing import Any
from unittest import TestCase, mock

import pytest

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.apidocs.hooks import (
    _ENDPOINT_SERVERS,
    _INTERNAL_OPERATIONS,
    PUBLISH_STATUS_EXTENSION,
    _fix_nullable_enums,
    custom_postprocessing_hook,
    custom_preprocessing_hook,
)
from sentry.apidocs.utils import SentryApiBuildError


class EndpointServersTest(TestCase):
    def setUp(self) -> None:
        _ENDPOINT_SERVERS.clear()

    def tearDown(self) -> None:
        _ENDPOINT_SERVERS.clear()

    def test_servers_applied_to_endpoint(self) -> None:
        """Test that servers from _ENDPOINT_SERVERS are applied to matching paths."""
        _ENDPOINT_SERVERS["/api/0/seer/models/"] = [{"url": "https://{region}.sentry.io"}]

        result = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/seer/models/": {
                    "get": {
                        "tags": ["Seer"],
                        "description": "Get models",
                        "operationId": "get models",
                        "parameters": [],
                    }
                },
                "/api/0/other/endpoint/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Other endpoint",
                        "operationId": "get other",
                        "parameters": [],
                    }
                },
            },
        }

        processed = custom_postprocessing_hook(result, None)

        # Servers should be applied to the matching endpoint
        assert processed["paths"]["/api/0/seer/models/"]["get"]["servers"] == [
            {"url": "https://{region}.sentry.io"}
        ]
        # Servers should NOT be applied to non-matching endpoint
        assert "servers" not in processed["paths"]["/api/0/other/endpoint/"]["get"]


class SummaryUniquenessTest(TestCase):
    def _operation(self, summary: str) -> dict[str, Any]:
        return {
            "tags": ["Events"],
            "description": "An endpoint",
            "operationId": summary.lower().replace(" ", "-"),
            "summary": summary,
            "parameters": [],
        }

    def test_duplicate_summary_raises(self) -> None:
        result = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/foo/": {"get": self._operation("List Foos")},
                "/api/0/bar/": {"get": self._operation("List Foos")},
            },
        }
        with pytest.raises(SentryApiBuildError):
            custom_postprocessing_hook(result, None)

    def test_unique_summaries_pass(self) -> None:
        result = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/foo/": {"get": self._operation("List Foos")},
                "/api/0/bar/": {"get": self._operation("List Bars")},
            },
        }
        # Should not raise.
        custom_postprocessing_hook(result, None)


class FixIssueRoutesTest(TestCase):
    def test_issue_route_fixes(self) -> None:
        BEFORE = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/organizations/{organization_id_or_slug}/{var}/{issue_id}/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Get issues",
                        "operationId": "get issue",
                        "parameters": [
                            {
                                "in": "path",
                                "name": "organization_id_or_slug",
                                "schema": {"type": "string"},
                                "description": "The ID or slug of the organization the resource belongs to.",
                                "required": True,
                            },
                            {
                                "in": "path",
                                "name": "var",
                                "schema": {"type": "string"},
                                "description": "Issues or groups",
                                "required": True,
                            },
                        ],
                    }
                },
                "/api/0/{var}/{issue_id}/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Get issues",
                        "operationId": "get issue",
                        "parameters": [
                            {
                                "in": "path",
                                "name": "var",
                                "schema": {"type": "string"},
                                "description": "Issues or groups",
                                "required": True,
                            },
                        ],
                    }
                },
                "/api/0/some/path/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Something else",
                        "operationId": "get something",
                        "parameters": [],
                    }
                },
            },
        }

        # Issue route with /organizations/{organization_id_or_slug}/ should be removed
        # Issue route with /{var}/{issue_id}/ should be renamed to /issues/{issue_id}/
        # "var" and "organization_id_or_slug" path parameters should be removed
        AFTER = {
            "paths": {
                "/api/0/some/path/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Something else",
                        "operationId": "get something",
                        "parameters": [],
                    }
                },
                "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Get issues",
                        "operationId": "get issue",
                        "parameters": [],
                    }
                },
            },
            "components": {"schemas": {}},
        }
        assert custom_postprocessing_hook(BEFORE, None) == AFTER


class FixNullableEnumsTest(TestCase):
    def test_adds_null_to_nullable_enum(self) -> None:
        schema = {"enum": ["a", "b"], "type": "string", "nullable": True}
        _fix_nullable_enums(schema)
        assert schema["enum"] == ["a", "b", None]

    def test_does_not_duplicate_null(self) -> None:
        schema = {"enum": ["a", None], "type": "string", "nullable": True}
        _fix_nullable_enums(schema)
        assert schema["enum"] == ["a", None]

    def test_ignores_non_nullable_enum(self) -> None:
        schema = {"enum": ["a", "b"], "type": "string"}
        _fix_nullable_enums(schema)
        assert schema["enum"] == ["a", "b"]

    def test_ignores_nullable_without_enum(self) -> None:
        schema = {"type": "string", "nullable": True}
        _fix_nullable_enums(schema)
        assert schema == {"type": "string", "nullable": True}

    def test_recurses_into_nested_dicts_and_lists(self) -> None:
        result = {
            "components": {
                "schemas": {
                    "Group": {
                        "properties": {
                            "substatus": {
                                "enum": ["ongoing", "new"],
                                "type": "string",
                                "nullable": True,
                            },
                            "status": {
                                "enum": ["resolved", "unresolved"],
                                "type": "string",
                            },
                        }
                    }
                }
            },
            "anyOfExample": [
                {"enum": ["x"], "nullable": True},
                {"type": "object", "nullable": True},
            ],
        }
        _fix_nullable_enums(result)
        # Nullable enums gain null wherever they are nested (deep in dicts and inside
        # lists); the non-nullable enum and the nullable-but-enumless schema are left
        # untouched.
        assert result == {
            "components": {
                "schemas": {
                    "Group": {
                        "properties": {
                            "substatus": {
                                "enum": ["ongoing", "new", None],
                                "type": "string",
                                "nullable": True,
                            },
                            "status": {
                                "enum": ["resolved", "unresolved"],
                                "type": "string",
                            },
                        }
                    }
                }
            },
            "anyOfExample": [
                {"enum": ["x", None], "nullable": True},
                {"type": "object", "nullable": True},
            ],
        }


def _fake_endpoint(publish_status: dict[str, Any], **handlers: Any) -> Any:
    """A callback whose ``view_class`` carries only what the preprocessing hook reads."""
    from sentry.api.api_owners import ApiOwner

    namespace: dict[str, Any] = {
        "owner": ApiOwner.ISSUES,
        "publish_status": publish_status,
        "__module__": "sentry.api.endpoints.fake",
    }
    namespace.update(handlers)
    view_class = type("FakeEndpoint", (), namespace)

    class Callback:
        pass

    callback = Callback()
    callback.view_class = view_class  # type: ignore[attr-defined]
    return callback


def _public_operation(operation_id: str) -> dict[str, Any]:
    return {
        "tags": ["Events"],
        "description": "Documented",
        "operationId": operation_id,
        "parameters": [],
    }


class InternalBuildTest(TestCase):
    def setUp(self) -> None:
        _INTERNAL_OPERATIONS.clear()

    def tearDown(self) -> None:
        _INTERNAL_OPERATIONS.clear()

    def _endpoints(self) -> list[tuple[str, str, str, Any]]:
        def documented(self: Any, request: Any) -> None:
            pass

        setattr(documented, "kwargs", {"schema": object()})  # left behind by @extend_schema

        def undocumented(self: Any, request: Any) -> None:
            pass

        public = _fake_endpoint({"GET": ApiPublishStatus.PUBLIC}, get=documented)
        private_documented = _fake_endpoint({"GET": ApiPublishStatus.PRIVATE}, get=documented)
        private_undocumented = _fake_endpoint(
            {"GET": ApiPublishStatus.EXPERIMENTAL}, get=undocumented
        )
        return [
            ("/api/0/public/", "^api/0/public/$", "GET", public),
            ("/api/0/private/", "^api/0/private/$", "GET", private_documented),
            ("/api/0/undocumented/", "^api/0/undocumented/$", "GET", private_undocumented),
        ]

    @mock.patch("sentry.apidocs.hooks.__write_ownership_data")
    def test_public_build_only_keeps_public_methods(self, _write: mock.Mock) -> None:
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SENTRY_OPENAPI_INTERNAL", None)
            filtered = custom_preprocessing_hook(self._endpoints())

        assert [path for path, *_ in filtered] == ["/api/0/public/"]
        assert _INTERNAL_OPERATIONS == {}

    @mock.patch("sentry.apidocs.hooks.__write_ownership_data")
    def test_internal_build_admits_private_methods_that_declare_a_schema(
        self, _write: mock.Mock
    ) -> None:
        with mock.patch.dict(os.environ, {"SENTRY_OPENAPI_INTERNAL": "1"}):
            filtered = custom_preprocessing_hook(self._endpoints())

        assert [path for path, *_ in filtered] == ["/api/0/public/", "/api/0/private/"]
        assert _INTERNAL_OPERATIONS == {("/api/0/private/", "get"): ApiPublishStatus.PRIVATE}

    def test_internal_postprocessing_stamps_status_and_skips_reference_checks(self) -> None:
        _INTERNAL_OPERATIONS[("/api/0/private/", "get")] = ApiPublishStatus.PRIVATE
        result = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/public/": {"get": _public_operation("public")},
                # No tag and no description would fail the public checks;
                # internal operations are exempt from them.
                "/api/0/private/": {"get": {"operationId": "private", "parameters": []}},
            },
        }

        with mock.patch.dict(os.environ, {"SENTRY_OPENAPI_INTERNAL": "1"}):
            processed = custom_postprocessing_hook(result, None)

        assert processed["paths"]["/api/0/public/"]["get"][PUBLISH_STATUS_EXTENSION] == "public"
        assert processed["paths"]["/api/0/private/"]["get"][PUBLISH_STATUS_EXTENSION] == "private"

    def test_internal_postprocessing_still_checks_public_operations(self) -> None:
        result = {
            "components": {"schemas": {}},
            "paths": {"/api/0/public/": {"get": {"operationId": "public", "parameters": []}}},
        }
        with (
            mock.patch.dict(os.environ, {"SENTRY_OPENAPI_INTERNAL": "1"}),
            pytest.raises(SentryApiBuildError),
        ):
            custom_postprocessing_hook(result, None)

    def test_public_build_does_not_stamp_status(self) -> None:
        result = {
            "components": {"schemas": {}},
            "paths": {"/api/0/public/": {"get": _public_operation("public")}},
        }
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SENTRY_OPENAPI_INTERNAL", None)
            processed = custom_postprocessing_hook(result, None)

        assert PUBLISH_STATUS_EXTENSION not in processed["paths"]["/api/0/public/"]["get"]
