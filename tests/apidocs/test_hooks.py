from typing import Any
from unittest import TestCase

import pytest

from sentry.apidocs.extensions import SHAPING_EXTENSION
from sentry.apidocs.hooks import (
    _ENDPOINT_SERVERS,
    _fix_nullable_enums,
    custom_postprocessing_hook,
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


class ResponseShapingTest(TestCase):
    def _operation(self, **extra: Any) -> dict[str, Any]:
        return {
            "tags": ["Teams"],
            "description": "List teams",
            "operationId": "list teams",
            "parameters": [
                {
                    "in": "query",
                    "name": "expand",
                    "description": "Additional data to include in the response.",
                    "schema": {"type": "array", "items": {"enum": ["projects", "externalTeams"]}},
                },
                {
                    "in": "query",
                    "name": "collapse",
                    "description": "Fields to remove.",
                    "schema": {"enum": ["organization"]},
                },
            ],
            "responses": {
                "200": {
                    "content": {
                        "application/json": {"schema": {"$ref": "#/components/schemas/TeamList"}}
                    }
                }
            },
            **extra,
        }

    def test_stamps_expand_and_collapse_from_the_response_shaping(self) -> None:
        result = {
            "components": {
                "schemas": {
                    "TeamList": {
                        "type": "array",
                        "items": {"$ref": "#/components/schemas/Team"},
                    },
                    "Team": {
                        "type": "object",
                        "properties": {"id": {"type": "string"}},
                        SHAPING_EXTENSION: {
                            "expand": {
                                "projects": ["projects"],
                                "externalTeams": ["externalTeams"],
                                "organization": ["organization"],
                            },
                            "collapse": {"organization": ["organization"]},
                        },
                    },
                }
            },
            "paths": {"/api/0/teams/": {"get": self._operation()}},
        }

        processed = custom_postprocessing_hook(result, None)

        operation = processed["paths"]["/api/0/teams/"]["get"]
        # Restricted to the values the parameter's enum documents.
        assert operation["x-sentry-expand"] == {
            "projects": ["projects"],
            "externalTeams": ["externalTeams"],
        }
        assert operation["x-sentry-collapse"] == {"organization": ["organization"]}
        # The marker never reaches the published components.
        assert SHAPING_EXTENSION not in processed["components"]["schemas"]["Team"]

    def test_operation_without_shaping_parameters_is_untouched(self) -> None:
        operation = self._operation(parameters=[])
        result = {
            "components": {"schemas": {"TeamList": {"type": "array", "items": {"type": "object"}}}},
            "paths": {"/api/0/teams/": {"get": operation}},
        }

        processed = custom_postprocessing_hook(result, None)

        assert "x-sentry-expand" not in processed["paths"]["/api/0/teams/"]["get"]
        assert "x-sentry-collapse" not in processed["paths"]["/api/0/teams/"]["get"]
