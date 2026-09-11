from __future__ import annotations

from typing import Any

import pytest

from tools.api_contracts_to_typescript import (
    TypeScriptEmitter,
    collect_operations,
    load_known_routes,
    render_contracts,
    render_examples,
    spec_path_to_route,
)


@pytest.mark.parametrize(
    ("path", "expected"),
    (
        (
            "/api/0/organizations/{organization_id_or_slug}/projects/",
            "/organizations/$organizationIdOrSlug/projects/",
        ),
        (
            "/api/0/organizations/{organization_id_or_slug}/events/{project_id_or_slug}:{event_id}/",
            "/organizations/$organizationIdOrSlug/events/$projectIdOrSlug:$eventId/",
        ),
        ("/api/0/organizations/", "/organizations/"),
    ),
)
def test_spec_path_to_route(path: str, expected: str) -> None:
    assert spec_path_to_route(path) == expected


def test_load_known_routes() -> None:
    source = """
export type KnownSentryApiUrls =
  | '/'
  | '/organizations/$organizationIdOrSlug/'
  | '/organizations/$organizationIdOrSlug/projects/';
"""
    assert load_known_routes(source) == {
        "/",
        "/organizations/$organizationIdOrSlug/",
        "/organizations/$organizationIdOrSlug/projects/",
    }


COMPONENTS: dict[str, Any] = {
    "Team": {
        "type": "object",
        "description": "A team.",
        "properties": {"id": {"type": "string"}, "slug": {"type": "string"}},
        "required": ["id", "slug"],
        "additionalProperties": False,
    },
    "Status": {"type": "string", "enum": ["active", "pending", None], "nullable": True},
}


@pytest.mark.parametrize(
    ("schema", "expected"),
    (
        ({"type": "string"}, "string"),
        ({"type": "string", "format": "date-time", "nullable": True}, "string | null"),
        ({"type": "integer"}, "number"),
        ({"type": "boolean"}, "boolean"),
        ({"type": "array", "items": {"$ref": "#/components/schemas/Team"}}, "Team[]"),
        ({"type": "array", "items": {"type": "string", "nullable": True}}, "Array<string | null>"),
        (
            {
                "type": "array",
                "items": {"type": "object", "properties": {"id": {"type": "string"}}},
            },
            "Array<{\n  id?: string;\n}>",
        ),
        ({"$ref": "#/components/schemas/Team", "nullable": True}, "Team | null"),
        ({"enum": ["a", "b"], "type": "string"}, '"a" | "b"'),
        ({"enum": [1, 2]}, "1 | 2"),
        ({"anyOf": [{"type": "string"}, {"type": "integer"}]}, "string | number"),
        ({"oneOf": [{"type": "string"}, {"type": "string"}]}, "string"),
        (
            {"allOf": [{"$ref": "#/components/schemas/Team"}, {"type": "object"}]},
            "Team & Record<string, unknown>",
        ),
        ({"type": "object"}, "Record<string, unknown>"),
        ({"type": "object", "additionalProperties": {"type": "integer"}}, "Record<string, number>"),
        ({"type": "object", "additionalProperties": False}, "Record<string, never>"),
        ({"type": ["string", "null"]}, "string | null"),
        ({"x-sentry-unresolved": "<class 'Foo'>"}, "unknown"),
        ({}, "unknown"),
    ),
)
def test_schema_to_ts(schema: dict[str, Any], expected: str) -> None:
    assert TypeScriptEmitter(COMPONENTS).schema_to_ts(schema) == expected


def test_object_properties_required_first_then_sorted_with_quoted_keys() -> None:
    schema = {
        "type": "object",
        "properties": {
            "isMember": {"type": "boolean"},
            "idp:provisioned": {"type": "boolean"},
            "slug": {"type": "string"},
            "id": {"type": "string"},
        },
        "required": ["slug", "id"],
    }
    assert TypeScriptEmitter(COMPONENTS).schema_to_ts(schema) == (
        '{\n  id: string;\n  slug: string;\n  "idp:provisioned"?: boolean;\n  isMember?: boolean;\n}'
    )


def test_component_declaration_carries_description() -> None:
    assert TypeScriptEmitter(COMPONENTS).component_declaration("Team") == [
        "/** A team. */",
        "export type Team = {\n  id: string;\n  slug: string;\n};",
    ]
    assert TypeScriptEmitter(COMPONENTS).component_declaration("Status") == [
        'export type Status = "active" | "pending" | null;',
    ]


def test_unknown_reference_fails() -> None:
    with pytest.raises(ValueError):
        TypeScriptEmitter(COMPONENTS).schema_to_ts({"$ref": "#/components/schemas/Nope"})


SPEC: dict[str, Any] = {
    "components": {"schemas": COMPONENTS},
    "paths": {
        "/api/0/organizations/{organization_id_or_slug}/teams/": {
            "get": {
                "operationId": "List an Organization's Teams",
                "x-sentry-publish-status": "public",
                "responses": {
                    "200": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "array",
                                    "items": {"$ref": "#/components/schemas/Team"},
                                },
                                "examples": {
                                    "Two teams": {
                                        "summary": "Two teams",
                                        "value": [
                                            {"id": "1", "slug": "ants"},
                                            {"id": "2", "slug": "bees"},
                                        ],
                                    }
                                },
                            }
                        }
                    },
                    "403": {"description": "Forbidden"},
                },
            },
            "post": {
                "operationId": "Create a Team",
                "x-sentry-publish-status": "private",
                "responses": {
                    "201": {
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/Team"}}
                        }
                    }
                },
            },
            "delete": {"operationId": "Nope", "responses": {"204": {"description": "gone"}}},
        },
        "/api/0/not-a-known-route/": {
            "get": {
                "responses": {
                    "200": {"content": {"application/json": {"schema": {"type": "string"}}}}
                }
            }
        },
    },
}
KNOWN = {"/organizations/$organizationIdOrSlug/teams/"}


def test_render_contracts_emits_components_and_mapping() -> None:
    out = render_contracts(SPEC, collect_operations(SPEC, KNOWN))

    assert 'export type Status = "active" | "pending" | null;' in out
    assert "export type Team = {" in out
    assert (
        '  "/organizations/$organizationIdOrSlug/teams/": {\n'
        "    /** List an Organization's Teams (public) */\n"
        "    GET: {response: Team[]};\n"
        "    /** Create a Team (private) */\n"
        "    POST: {response: Team};\n"
        "  };"
    ) in out
    # 204 with no body, and routes the frontend cannot name, are left out.
    assert "DELETE" not in out
    assert "not-a-known-route" not in out


def test_render_examples_keys_by_route_method_and_name() -> None:
    out = render_examples(collect_operations(SPEC, KNOWN))

    assert "import type {ApiMapping} from 'sentry/utils/api/apiContracts.generated';" in out
    assert (
        '  "/organizations/$organizationIdOrSlug/teams/": {\n    GET: {\n      "Two teams": ['
        in out
    )
    assert '"slug": "bees"' in out
    # POST has a schema but no example, so it is left out entirely.
    assert "POST" not in out
    assert out.rstrip().endswith("} satisfies ApiExamples;")
