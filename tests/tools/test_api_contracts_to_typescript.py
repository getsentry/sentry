from __future__ import annotations

import re
from itertools import permutations
from typing import Any

import pytest

from tools.api_contracts_to_typescript import (
    TypeScriptEmitter,
    collect_operations,
    load_known_routes,
    name_enums,
    render_contracts,
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
            {"type": "array", "items": {"type": "array", "items": {"type": "number"}}},
            "number[][]",
        ),
        (
            {
                "type": "array",
                "items": {"type": "array", "items": {"type": "number"}},
                "nullable": True,
            },
            "number[][] | null",
        ),
        (
            {
                "type": "array",
                "items": {
                    "anyOf": [
                        {"type": "string"},
                        {"type": "array", "items": {"type": "number"}},
                    ]
                },
            },
            "Array<string | number[]>",
        ),
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


def test_enum_order_is_stable_without_coercing_json_literal_types() -> None:
    emitter = TypeScriptEmitter({})
    for values in permutations(["1", 1, True, False, None, 0.5]):
        assert emitter.schema_to_ts({"enum": values, "nullable": True}) == (
            '"1" | 0.5 | 1 | false | true | null'
        )


def test_enum_numeric_literals_have_no_zero_fractions() -> None:
    assert TypeScriptEmitter({}).schema_to_ts({"enum": [1.0, 1, -0.0, 0.25, 1e20]}) == (
        "-0 | 0.25 | 1 | 1e+20"
    )


def test_enum_string_literals_keep_number_like_text() -> None:
    assert TypeScriptEmitter({}).schema_to_ts({"enum": ["1.0", 'say "2.0"', "\\3.0"]}) == (
        r'"1.0" | "\\3.0" | "say \"2.0\""'
    )


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


def test_declaration_carries_description() -> None:
    emitter = TypeScriptEmitter(COMPONENTS)
    assert emitter.declaration("Team", COMPONENTS["Team"]) == [
        "/** A team. */",
        "export type Team = {\n  id: string;\n  slug: string;\n};",
    ]
    assert emitter.declaration("Status", COMPONENTS["Status"]) == [
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
    assert "export type ListAnOrganizationsTeamsResponse = Team[];" in out
    assert (
        '  "/organizations/$organizationIdOrSlug/teams/": {\n'
        "    /** List an Organization's Teams (public) */\n"
        "    GET: {response: ListAnOrganizationsTeamsResponse};\n"
        "    /** Create a Team (private) */\n"
        "    POST: {response: Team};\n"
        "  };"
    ) in out
    # 204 with no body, and routes the frontend cannot name, are left out.
    assert "DELETE" not in out
    assert "not-a-known-route" not in out


def _json_operation(schema: dict[str, Any], **extensions: Any) -> dict[str, Any]:
    return {
        "operationId": "op",
        "responses": {"200": {"content": {"application/json": {"schema": schema}}}},
        **extensions,
    }


def test_collect_operations_maps_every_path_alias() -> None:
    notes = "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/notes/"
    aliases = [
        notes,
        "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/comments/",
        "/api/0/organizations/{organization_id_or_slug}/groups/{issue_id}/notes/",
    ]
    operation = _json_operation({"type": "string"}, **{"x-sentry-path-aliases": aliases})
    known = {
        "/organizations/$organizationIdOrSlug/issues/$issueId/notes/",
        "/organizations/$organizationIdOrSlug/issues/$issueId/comments/",
    }

    operations = collect_operations({"paths": {notes: {"get": operation}}}, known)

    # The `groups` alias is not a route the frontend names, so it is left out.
    assert operations == {
        "/organizations/$organizationIdOrSlug/issues/$issueId/notes/": {"GET": operation},
        "/organizations/$organizationIdOrSlug/issues/$issueId/comments/": {"GET": operation},
    }


def test_collect_operations_prefers_a_path_over_an_alias_of_another() -> None:
    canonical = _json_operation({"type": "string"})
    aliased = _json_operation(
        {"type": "integer"},
        **{"x-sentry-path-aliases": ["/api/0/first/", "/api/0/second/"]},
    )
    spec = {"paths": {"/api/0/second/": {"get": canonical}, "/api/0/first/": {"get": aliased}}}

    operations = collect_operations(spec, {"/first/", "/second/"})

    assert operations == {"/first/": {"GET": aliased}, "/second/": {"GET": canonical}}


def test_render_contracts_leaves_undocumented_responses_out() -> None:
    spec = {
        "components": {"schemas": {}},
        "paths": {
            "/api/0/documented/": {"get": _json_operation({"type": "string"})},
            "/api/0/undocumented/": {
                "get": _json_operation({"x-sentry-undocumented": True}),
            },
        },
    }

    out = render_contracts(spec, collect_operations(spec, {"/documented/", "/undocumented/"}))

    assert '"/documented/"' in out
    assert "undocumented" not in out


def _object(**properties: dict[str, Any]) -> dict[str, Any]:
    return {"type": "object", "properties": properties, "required": sorted(properties)}


def _spec(components: dict[str, Any], paths: dict[str, Any]) -> dict[str, Any]:
    return {"components": {"schemas": components}, "paths": paths}


def _response_types(out: str) -> list[str]:
    return re.findall(r"\{response: ([^}]*)\}", out)


def test_render_contracts_names_every_response_type() -> None:
    responses: dict[str, dict[str, Any]] = {
        "component": {"$ref": "#/components/schemas/Team"},
        "nullable-component": {"$ref": "#/components/schemas/Team", "nullable": True},
        "array": {"type": "array", "items": {"$ref": "#/components/schemas/Team"}},
        "object": _object(id={"type": "string"}),
        "record": {"type": "object", "additionalProperties": {}},
        "primitive": {"type": "string"},
        "union": {"oneOf": [{"$ref": "#/components/schemas/Team"}, {"type": "string"}]},
        "unresolved": {"x-sentry-unresolved": "<class 'Foo'>"},
    }
    spec = _spec(
        COMPONENTS,
        {
            f"/api/0/{key}/": {"get": {**_json_operation(schema), "operationId": f"get {key}"}}
            for key, schema in responses.items()
        },
    )

    out = render_contracts(spec, collect_operations(spec, {f"/{key}/" for key in responses}))

    types = _response_types(out)
    assert len(types) == len(responses)
    assert all(re.fullmatch(r"[A-Za-z_$][\w$]*", t) for t in types), types
    assert "GET: {response: Team}" in out
    assert "export type GetNullableComponentResponse = Team | null;" in out
    assert "export type GetArrayResponse = Team[];" in out
    assert "export type GetObjectResponse = {\n  id: string;\n};" in out
    assert "export type GetUnresolvedResponse = unknown;" in out


def test_render_contracts_names_responses_uniquely() -> None:
    inline = _object(id={"type": "string"})
    other = _object(slug={"type": "string"})
    aliases = ["/api/0/issues/", "/api/0/groups/"]
    spec = _spec(
        {**COMPONENTS, "TeamResponse": {"type": "string"}},
        {
            # One operation on two routes is declared once.
            "/api/0/issues/": {
                "get": {
                    **_json_operation(inline),
                    "operationId": "List Issues",
                    "x-sentry-path-aliases": aliases,
                }
            },
            # The same operation id with another body gets the next free name.
            "/api/0/other-issues/": {
                "get": {**_json_operation(other), "operationId": "list_issues"}
            },
            # So does a name a component already has.
            "/api/0/team/": {"get": {**_json_operation(inline), "operationId": "team"}},
            # With no operation id, the method and route name it.
            "/api/0/projects/{project_id_or_slug}/": {
                "get": {"responses": _json_operation(inline)["responses"]}
            },
        },
    )
    known = {"/issues/", "/groups/", "/other-issues/", "/team/", "/projects/$projectIdOrSlug/"}

    out = render_contracts(spec, collect_operations(spec, known))

    assert out.count("export type ListIssuesResponse = ") == 1
    assert (
        '"/groups/": {\n    /** List Issues (public) */\n    GET: {response: ListIssuesResponse}'
        in out
    )
    assert (
        '"/issues/": {\n    /** List Issues (public) */\n    GET: {response: ListIssuesResponse}'
        in out
    )
    assert "GET: {response: ListIssuesResponse2}" in out
    assert "export type TeamResponse = string;" in out
    assert "GET: {response: TeamResponse2}" in out
    assert "GET: {response: GetProjectsProjectIdOrSlugResponse}" in out


TIMEZONES = ["Europe/Vienna", "America/Toronto", "Asia/Tokyo"]


def test_render_contracts_declares_a_repeated_enum_once() -> None:
    string_enum = {"type": "string"}
    components = {
        "Registration": _object(timezone={**string_enum, "enum": ["", *TIMEZONES]}),
        "Options": _object(
            timezone={**string_enum, "enum": TIMEZONES[::-1], "nullable": True},
            # Used once: inline.
            theme={**string_enum, "enum": ["dark", "light"]},
            # One member is a discriminator: inline, however often it is used.
            type={**string_enum, "enum": ["user"]},
        ),
        "Validator": _object(
            zones={"type": "array", "items": {**string_enum, "enum": TIMEZONES}},
            type={**string_enum, "enum": ["user"]},
        ),
    }
    spec = _spec(components, {})

    out = render_contracts(spec, {})

    assert 'export type TimezoneEnum = "America/Toronto" | "Asia/Tokyo" | "Europe/Vienna";' in out
    assert 'timezone: TimezoneEnum | "";' in out
    assert "timezone: TimezoneEnum | null;" in out
    assert "zones: TimezoneEnum[];" in out
    assert out.count("Europe/Vienna") == 1
    assert 'theme: "dark" | "light";' in out
    assert 'type: "user";' in out


def test_name_enums_qualifies_names_enums_would_share() -> None:
    statuses = ('"active"', '"disabled"')
    issue_statuses = ('"resolved"', '"unresolved"')
    roles = ('"admin"', '"member"')
    levels = ('"error"', '"info"')

    names = name_enums(
        {
            statuses: [("Monitor", "status"), ("Alert", "status")],
            issue_statuses: [("Issue", "status"), ("Group", "status")],
            # The property it types most often, then the shortest.
            roles: [("Org", "defaultRole"), ("Team", "role"), ("Member", "orgRole")],
            # A name a type already has.
            levels: [("Event", "level"), ("Log", "level")],
        },
        taken={"LevelEnum"},
    )

    assert names == {
        statuses: "AlertStatusEnum",
        issue_statuses: "GroupStatusEnum",
        roles: "RoleEnum",
        levels: "EventLevelEnum",
    }


def test_name_enums_never_reuses_a_name() -> None:
    a, b, c = ('"a"', '"b"'), ('"c"', '"d"'), ('"e"', '"f"')

    names = name_enums(
        {
            # Both want TypeEnum, so each is qualified, and the qualified name AlertTypeEnum
            # is one another enum has unqualified.
            a: [("Alert", "type"), ("Alert", "type")],
            b: [("Alert", "type"), ("Bell", "type")],
            c: [("X", "alertType"), ("Y", "alertType")],
        },
        taken=set(),
    )

    assert names == {c: "AlertTypeEnum", a: "AlertTypeEnum2", b: "AlertTypeEnum3"}
