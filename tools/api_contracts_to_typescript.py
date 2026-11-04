#!/usr/bin/env python3
# flake8: noqa: S002
"""
Generate TypeScript API contracts from the internal OpenAPI spec.

Reads the spec written by ``make build-internal-api-docs`` and writes
``static/app/utils/api/apiContracts.generated.ts``: one type per component schema,
plus ``ApiMapping``, which maps every known API route to the response type of each
HTTP method that declares one.

``ApiMapping`` names every response type rather than spelling it out. A response that is
not a component is declared as ``<OperationId>Response``. An enum that types properties
in more than one place is declared once, as ``<Property>Enum``, and referred to by name.

Usage:
    make build-api-contracts
    python3 -m tools.api_contracts_to_typescript [--spec tests/apidocs/openapi-internal.json]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from collections.abc import Collection, Iterable, Mapping, Sequence
from typing import Any

from tools.api_urls_to_typescript import snake_to_camel_case

API_PREFIX = "/api/0"
SPEC_PATH = "tests/apidocs/openapi-internal.json"
KNOWN_URLS_PATH = "static/app/utils/api/knownSentryApiUrls.generated.ts"
CONTRACTS_PATH = "static/app/utils/api/apiContracts.generated.ts"

HTTP_METHODS = ("get", "post", "put", "patch", "delete")
SUCCESS_CODES = ("200", "201", "202", "208")
# Vendor extensions the internal build stamps on the spec; see sentry.apidocs.internal.
# They are spelled out rather than imported so this script runs without Django.
UNRESOLVED_EXTENSION = "x-sentry-unresolved"
UNDOCUMENTED_EXTENSION = "x-sentry-undocumented"
PUBLISH_STATUS_EXTENSION = "x-sentry-publish-status"
PATH_ALIASES_EXTENSION = "x-sentry-path-aliases"

IDENTIFIER = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")
WORD = re.compile(r"[A-Za-z0-9]+")
PATH_PARAM = re.compile(r"\{([^}]+)\}")
SIMPLE_ARRAY_ITEM = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*(?:\[\])*$")
# Match strings first so number-like text inside them is never rewritten.
JSON_ZERO_FRACTION = re.compile(r'("(?:[^"\\]|\\.)*")|(-?\d+)\.0(?=[eE,\s}\]]|$)')

# Enum members a declared enum leaves to the use site, as drf-spectacular's enum hook
# does with its BlankEnum and NullEnum, so a choice set is one enum whether or not a
# field also accepts a blank or null. In the order they follow the enum's name.
OPTIONAL_LITERALS = ('""', "null")

# ``{route: {METHOD: operation}}``
Operations = dict[str, dict[str, Mapping[str, Any]]]
# An enum's members as TypeScript literals, sorted, without OPTIONAL_LITERALS.
EnumMembers = tuple[str, ...]
# Where an enum types a property: ``(declaring type, property)``.
EnumUse = tuple[str, str]


def spec_path_to_route(path: str) -> str:
    """
    Convert an OpenAPI path to the route shape used by ``KnownSentryApiUrls``.

    >>> spec_path_to_route("/api/0/organizations/{organization_id_or_slug}/projects/")
    '/organizations/$organizationIdOrSlug/projects/'
    """
    if path.startswith(API_PREFIX):
        path = path[len(API_PREFIX) :]
    return PATH_PARAM.sub(lambda m: "$" + snake_to_camel_case(m.group(1)), path)


def load_known_routes(known_urls_source: str) -> set[str]:
    """Extract the string-literal union members from ``knownSentryApiUrls.generated.ts``."""
    return set(re.findall(r"^\s*\|\s*'([^']+)'", known_urls_source, flags=re.MULTILINE))


def ts_string(value: str) -> str:
    return json.dumps(value)


def ts_json(value: Any) -> str:
    """Render a JSON literal as TypeScript without redundant zero fractions, preserving -0."""
    body = json.dumps(value, ensure_ascii=False)
    return JSON_ZERO_FRACTION.sub(lambda match: match[1] or match[2], body)


def ts_key(name: str) -> str:
    return name if IDENTIFIER.match(name) and "$" not in name else ts_string(name)


def pascal_case(text: str) -> str:
    """
    >>> pascal_case("List a Project's Issues")
    'ListAProjectsIssues'
    >>> pascal_case("canvas_theme")
    'CanvasTheme'
    """
    return "".join(word[0].upper() + word[1:] for word in WORD.findall(text.replace("'", "")))


def unique_name(base: str, taken: Collection[str]) -> str:
    """``base``, or ``base`` with the first number from 2 that makes it a name not taken."""
    name, number = base, 2
    while name in taken:
        name, number = f"{base}{number}", number + 1
    return name


def ts_comment(text: str, indent: str = "") -> list[str]:
    text = text.strip().replace("*/", "*\\/")
    if not text:
        return []
    lines = [line.rstrip() for line in text.splitlines()]
    if len(lines) == 1:
        return [f"{indent}/** {lines[0]} */"]
    return [f"{indent}/**", *(f"{indent} * {line}".rstrip() for line in lines), f"{indent} */"]


class TypeScriptEmitter:
    """Turns the OpenAPI 3.0 schema subset drf-spectacular emits into TypeScript."""

    def __init__(self, components: Mapping[str, Any]) -> None:
        self.components = components
        # The enums declared once and referred to by name; see hoist_enums.
        self.enums: dict[EnumMembers, str] = {}
        # While hoist_enums looks for repeated enums: every enum seen, and where.
        self._enum_uses: defaultdict[EnumMembers, list[EnumUse]] | None = None
        self._declaring = ""

    def ref_name(self, ref: str) -> str:
        name = ref.rsplit("/", 1)[-1]
        if not IDENTIFIER.match(name):
            raise ValueError(f"component name {name!r} is not a valid TypeScript identifier")
        if name not in self.components:
            raise ValueError(f"unknown component reference {ref!r}")
        return name

    def schema_to_ts(
        self, schema: Mapping[str, Any], indent: str = "", prop: str | None = None
    ) -> str:
        """``prop`` is the property ``schema`` types, if any, which names its enum."""
        if UNRESOLVED_EXTENSION in schema:
            return "unknown"
        if "$ref" in schema:
            return self._nullable(self.ref_name(schema["$ref"]), schema)

        if "allOf" in schema:
            parts = [
                self._parenthesize(self.schema_to_ts(s, indent, prop)) for s in schema["allOf"]
            ]
            return self._nullable(" & ".join(parts), schema)
        for key in ("anyOf", "oneOf"):
            if key in schema:
                parts = [self.schema_to_ts(s, indent, prop) for s in schema[key]]
                return self._nullable(" | ".join(dict.fromkeys(parts)), schema)

        if "enum" in schema:
            return self._nullable(self._enum_to_ts(schema["enum"], prop), schema)

        schema_type = schema.get("type")
        if isinstance(schema_type, list):
            # OpenAPI 3.1 style: ["string", "null"]
            parts = [self.schema_to_ts({**schema, "type": t}, indent, prop) for t in schema_type]
            return " | ".join(dict.fromkeys(parts))

        if schema_type == "null":
            return "null"
        if schema_type == "string":
            return self._nullable("string", schema)
        if schema_type in ("integer", "number"):
            return self._nullable("number", schema)
        if schema_type == "boolean":
            return self._nullable("boolean", schema)
        if schema_type == "array":
            item = self.schema_to_ts(schema.get("items", {}), indent, prop)
            # `T[]` for simple element types, `Array<T>` otherwise, to match the
            # repo's typescript/array-type lint setting.
            array = f"{item}[]" if SIMPLE_ARRAY_ITEM.fullmatch(item) else f"Array<{item}>"
            return self._nullable(array, schema)
        if schema_type == "object" or "properties" in schema:
            return self._nullable(self._object_to_ts(schema, indent, prop), schema)
        return "unknown"

    def _enum_to_ts(self, values: Iterable[Any], prop: str | None) -> str:
        # Choices may originate in a set. Sort serialized literals so mixed
        # JSON types remain distinct (e.g. true, 1, and "1").
        literals = sorted(
            {ts_json(value) for value in values},
            key=lambda literal: (literal == "null", literal),
        )
        members = tuple(literal for literal in literals if literal not in OPTIONAL_LITERALS)
        # One member is a discriminator, such as `type: "http"`, which reads best inline.
        if self._enum_uses is not None and prop is not None and len(members) > 1:
            self._enum_uses[members].append((self._declaring, prop))
        name = self.enums.get(members)
        if name is None:
            return " | ".join(literals)
        return " | ".join(
            [name, *(literal for literal in OPTIONAL_LITERALS if literal in literals)]
        )

    def _object_to_ts(self, schema: Mapping[str, Any], indent: str, prop: str | None) -> str:
        properties: Mapping[str, Any] = schema.get("properties", {})
        additional = schema.get("additionalProperties")
        if not properties:
            if isinstance(additional, Mapping):
                return f"Record<string, {self.schema_to_ts(additional, indent, prop)}>"
            if additional is False:
                return "Record<string, never>"
            return "Record<string, unknown>"

        required = set(schema.get("required", []))
        inner = indent + "  "
        lines = ["{"]
        # Required keys first, then ascending by name, to match the repo's
        # @sentry/sort-interface-keys lint rule (case-sensitive, non-natural).
        ordered = sorted(properties.items(), key=lambda item: (item[0] not in required, item[0]))
        for name, value in ordered:
            optional = "" if name in required else "?"
            lines.append(
                f"{inner}{ts_key(name)}{optional}: {self.schema_to_ts(value, inner, name)};"
            )
        if isinstance(additional, Mapping):
            # Typed extra keys next to declared properties cannot be expressed
            # without an index signature that every property must satisfy, so the
            # declared properties win and the extras are left open.
            lines.append(f"{inner}[key: string]: unknown;")
        lines.append(f"{indent}}}")
        return "\n".join(lines)

    @staticmethod
    def _parenthesize(text: str) -> str:
        return f"({text})" if " | " in text or " & " in text else text

    @classmethod
    def _nullable(cls, text: str, schema: Mapping[str, Any]) -> str:
        if not schema.get("nullable") or text == "null" or text.endswith("| null"):
            return text
        return f"{cls._parenthesize(text) if ' & ' in text else text} | null"

    def hoist_enums(self, declarations: Mapping[str, Mapping[str, Any]]) -> None:
        """Declare once every enum that types properties in more than one place in the
        types ``declarations`` declares by name, so ``schema_to_ts`` names it there."""
        self._enum_uses = defaultdict(list)
        try:
            for name, schema in declarations.items():
                self._declaring = name
                self.schema_to_ts(schema)
            uses = dict(self._enum_uses)
        finally:
            self._enum_uses = None
            self._declaring = ""
        repeated = {members: places for members, places in uses.items() if len(places) > 1}
        self.enums = name_enums(repeated, taken=declarations.keys())

    def declarations(self, declarations: Mapping[str, Mapping[str, Any]]) -> list[str]:
        """``declarations`` and the enums hoisted out of them, in name order."""
        enums = {name: members for members, name in self.enums.items()}
        lines: list[str] = []
        for name in sorted(declarations.keys() | enums.keys()):
            if name in enums:
                lines.append(f"export type {name} = {' | '.join(enums[name])};")
            else:
                lines.extend(self.declaration(name, declarations[name]))
            lines.append("")
        return lines

    def declaration(self, name: str, schema: Mapping[str, Any]) -> list[str]:
        lines = ts_comment(schema.get("description", ""))
        lines.append(f"export type {name} = {self.schema_to_ts(schema)};")
        return lines


def name_enums(
    uses: Mapping[EnumMembers, Sequence[EnumUse]], taken: Collection[str]
) -> dict[EnumMembers, str]:
    """Name each enum after the property it types most often (then the shortest),
    ``<Property>Enum``, as drf-spectacular's enum hook does. Enums that would share a
    name, or take one already taken, are each ``<Type><Property>Enum`` instead, after
    the first type in name order that has the enum under that property."""
    picks: dict[EnumMembers, tuple[str, str]] = {}
    for members, places in uses.items():
        counts = Counter(pascal_case(prop) for _, prop in places)
        prop = min(counts, key=lambda candidate: (-counts[candidate], len(candidate), candidate))
        picks[members] = (prop, min(owner for owner, p in places if pascal_case(p) == prop))
    wanted = Counter(f"{prop}Enum" for prop, _ in picks.values())

    names: dict[EnumMembers, str] = {}
    qualified: list[tuple[str, EnumMembers]] = []
    for members, (prop, owner) in sorted(picks.items(), key=lambda item: (item[1], item[0])):
        name = f"{prop}Enum"
        if prop and wanted[name] == 1 and name not in taken and IDENTIFIER.match(name):
            names[members] = name
        else:
            qualified.append((f"{owner}{prop}Enum", members))
    # The unqualified names are settled first, so no qualified one can take theirs.
    used = {*taken, *names.values()}
    for base, members in qualified:
        names[members] = unique_name(base, used)
        used.add(names[members])
    return names


def success_response_schemas(operation: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    """The declared success bodies. An undeclared one is no contract, not `unknown`."""
    schemas: list[Mapping[str, Any]] = []
    for code in SUCCESS_CODES:
        content = operation.get("responses", {}).get(code, {}).get("content", {})
        body = content.get("application/json")
        if body and "schema" in body and UNDOCUMENTED_EXTENSION not in body["schema"]:
            schemas.append(body["schema"])
    return schemas


def operation_paths(path: str, operation: Mapping[str, Any]) -> list[str]:
    """Every path an operation answers on. The spec spells a route with literal
    alternatives, such as ``(?:issues|groups)``, by its first one and lists the rest."""
    return list(operation.get(PATH_ALIASES_EXTENSION) or [path])


def collect_operations(spec: Mapping[str, Any], known_routes: set[str]) -> Operations:
    """``{route: {METHOD: operation}}`` for every operation whose route the frontend can name.

    A path the spec spells directly wins over the same path reached as an alias."""
    canonical: Operations = {}
    aliased: Operations = {}
    unknown: set[str] = set()
    for path, methods in spec["paths"].items():
        for method in HTTP_METHODS:
            operation = methods.get(method)
            if operation is None:
                continue
            for alias in operation_paths(path, operation):
                route = spec_path_to_route(alias)
                if route not in known_routes:
                    unknown.add(route)
                    continue
                target = canonical if alias == path else aliased
                target.setdefault(route, {})[method.upper()] = operation
    operations: Operations = {route: dict(methods) for route, methods in aliased.items()}
    for route, methods in canonical.items():
        operations.setdefault(route, {}).update(methods)
    for route in sorted(unknown - operations.keys()):
        sys.stderr.write(f"skipping {route}: not in KnownSentryApiUrls\n")
    return operations


def name_responses(
    emitter: TypeScriptEmitter, operations: Operations
) -> tuple[dict[str, Mapping[str, Any]], dict[str, dict[str, list[str]]]]:
    """Name every operation's response types, so ``ApiMapping`` spells none out.

    A response that is a component, unmodified, is that component. Any other is declared
    as ``<OperationId>Response``, or with the first number from 2 after it that gives a
    name no other type has; an operation reached on several routes declares it once.

    Returns the declarations, and ``{route: {METHOD: [name, ...]}}``."""
    aliases: dict[str, Mapping[str, Any]] = {}
    names: dict[str, dict[str, list[str]]] = {}
    for route in sorted(operations):
        for method in sorted(operations[route]):
            operation = operations[route][method]
            types: list[str] = []
            for schema in success_response_schemas(operation):
                if set(schema) == {"$ref"}:
                    types.append(emitter.ref_name(schema["$ref"]))
                    continue
                label = pascal_case(operation.get("operationId", ""))
                if not IDENTIFIER.match(label):  # none, or one that starts with a digit
                    label = pascal_case(f"{method.lower()} {route}")
                base = name = f"{label}Response"
                number = 2
                while name in emitter.components or aliases.get(name, schema) != schema:
                    name, number = f"{base}{number}", number + 1
                aliases[name] = schema
                types.append(name)
            if types:
                names.setdefault(route, {})[method] = list(dict.fromkeys(types))
    return aliases, names


def render_contracts(spec: Mapping[str, Any], operations: Operations) -> str:
    components = spec.get("components", {}).get("schemas", {})
    emitter = TypeScriptEmitter(components)
    aliases, response_names = name_responses(emitter, operations)
    declarations = {**components, **aliases}
    emitter.hoist_enums(declarations)

    lines = [
        "/**",
        " * GENERATED FILE. Do not edit manually.",
        " * To update it run `make build-api-contracts`",
        " *",
        " * Response types for Sentry API endpoints, derived from the backend's",
        " * response TypedDicts and serializers via the internal OpenAPI spec.",
        " *",
        " * DEPLOYMENT: This is safe to deploy alongside backend changes.",
        " */",
        "",
    ]
    lines.extend(emitter.declarations(declarations))

    lines.append("export type ApiMapping = {")
    for route in sorted(response_names):
        lines.append(f"  {ts_string(route)}: {{")
        for method, types in sorted(response_names[route].items()):
            operation = operations[route][method]
            status = operation.get(PUBLISH_STATUS_EXTENSION, "public")
            label = operation.get("operationId", "")
            lines.extend(ts_comment(f"{label} ({status})".strip(), "    "))
            lines.append(f"    {method}: {{response: {' | '.join(types)}}};")
        lines.append("  };")
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spec", default=SPEC_PATH)
    parser.add_argument("--known-urls", default=KNOWN_URLS_PATH)
    parser.add_argument("--contracts", default=CONTRACTS_PATH)
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        with open(args.spec) as f:
            spec = json.load(f)
    except OSError:
        sys.stderr.write(f"{args.spec} not found; run `make build-internal-api-docs` first\n")
        return 1
    with open(args.known_urls) as f:
        known_routes = load_known_routes(f.read())

    operations = collect_operations(spec, known_routes)
    with open(args.contracts, "w") as f:
        f.write(render_contracts(spec, operations))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
