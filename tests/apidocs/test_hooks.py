from typing import Any
from unittest import TestCase
from unittest.mock import patch

import pytest

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.apidocs.hooks import (
    _ENDPOINT_SERVERS,
    _EXPERIMENTAL_OPERATIONS,
    EXPERIMENTAL_NOTICE,
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


class PublishStatusFilterTest(TestCase):
    """Only published statuses reach the OpenAPI pipeline, and PUBLIC_EXPERIMENTAL is marked."""

    def setUp(self) -> None:
        _EXPERIMENTAL_OPERATIONS.clear()

    def tearDown(self) -> None:
        _ENDPOINT_SERVERS.clear()
        _EXPERIMENTAL_OPERATIONS.clear()

    def _endpoint(self, path: str, status: ApiPublishStatus) -> tuple[Any, Any, str, Any]:
        view_class = type(
            "FakeEndpoint",
            (),
            {
                "owner": ApiOwner.CRONS,
                "publish_status": {"GET": status},
                "servers": None,
            },
        )
        callback = type("FakeCallback", (), {"view_class": view_class})
        return (path, path, "GET", callback)

    @patch("sentry.apidocs.hooks.__write_ownership_data")
    def test_only_published_statuses_pass_the_filter(self, _write_ownership: Any) -> None:
        endpoints = [
            self._endpoint("/api/0/public/", ApiPublishStatus.PUBLIC),
            self._endpoint("/api/0/public-experimental/", ApiPublishStatus.PUBLIC_EXPERIMENTAL),
            self._endpoint("/api/0/experimental/", ApiPublishStatus.EXPERIMENTAL),
            self._endpoint("/api/0/private/", ApiPublishStatus.PRIVATE),
        ]

        filtered = custom_preprocessing_hook(endpoints)

        assert [path for path, _regex, _method, _cb in filtered] == [
            "/api/0/public/",
            "/api/0/public-experimental/",
        ]
        assert _EXPERIMENTAL_OPERATIONS == {("/api/0/public-experimental/", "get")}

    def test_experimental_marker_stamped_on_operation(self) -> None:
        _EXPERIMENTAL_OPERATIONS.add(("/api/0/public-experimental/", "get"))

        result = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/public-experimental/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "An unstable endpoint",
                        "operationId": "get-unstable",
                        "parameters": [],
                    }
                },
                "/api/0/public/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "A stable endpoint",
                        "operationId": "get-stable",
                        "parameters": [],
                    }
                },
            },
        }

        processed = custom_postprocessing_hook(result, None)

        experimental = processed["paths"]["/api/0/public-experimental/"]["get"]
        assert experimental["x-sentry-experimental"] is True
        assert "x-sentry-experimental" not in processed["paths"]["/api/0/public/"]["get"]

        # The docs render the description, not the marker, so the notice is the
        # part a reader actually sees.
        assert experimental["description"] == f"{EXPERIMENTAL_NOTICE}\n\nAn unstable endpoint"
        assert processed["paths"]["/api/0/public/"]["get"]["description"] == "A stable endpoint"


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
