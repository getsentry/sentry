#!/usr/bin/env python3
# flake8: noqa: S002
"""
Generate TypeScript API contracts from the internal OpenAPI spec.

Inputs the spec written by ``make build-internal-api-docs`` and writes:

- ``static/app/utils/api/apiContracts.generated.ts``: one type per component
  schema, plus ``ApiMapping``, which maps every known API route to the response
  type of each HTTP method that declares one.
- ``tests/js/fixtures/generated/apiExamples.generated.ts``: the response examples
  attached to endpoints via ``@extend_schema(examples=...)``, keyed by route and
  method and checked against ``ApiMapping`` with ``satisfies``.

Usage:
    make build-api-contracts
    python3 -m tools.api_contracts_to_typescript [--spec tests/apidocs/openapi-internal.json]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Iterable, Mapping
from typing import Any

from tools.api_urls_to_typescript import snake_to_camel_case

API_PREFIX = "/api/0"
SPEC_PATH = "tests/apidocs/openapi-internal.json"
KNOWN_URLS_PATH = "static/app/utils/api/knownSentryApiUrls.generated.ts"
CONTRACTS_PATH = "static/app/utils/api/apiContracts.generated.ts"
EXAMPLES_PATH = "tests/js/fixtures/generated/apiExamples.generated.ts"

HTTP_METHODS = ("get", "post", "put", "patch", "delete")
SUCCESS_CODES = ("200", "201", "202", "208")
UNRESOLVED_EXTENSION = "x-sentry-unresolved"
PUBLISH_STATUS_EXTENSION = "x-sentry-publish-status"

IDENTIFIER = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")
PATH_PARAM = re.compile(r"\{([^}]+)\}")
SIMPLE_ARRAY_ITEM = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*(?:\[\])*$")
# Match strings first so number-like text inside them is never rewritten.
JSON_ZERO_FRACTION = re.compile(r'("(?:[^"\\]|\\.)*")|(-?\d+)\.0(?=[eE,\s}\]]|$)')

# ``{route: {METHOD: operation}}``
Operations = dict[str, dict[str, Mapping[str, Any]]]


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


def ts_json(value: Any, *, indent: int | None = None) -> str:
    """Render JSON as TypeScript without redundant zero fractions, preserving -0."""
    body = json.dumps(value, indent=indent, ensure_ascii=False)
    return JSON_ZERO_FRACTION.sub(lambda match: match[1] or match[2], body)


def ts_key(name: str) -> str:
    return name if IDENTIFIER.match(name) and "$" not in name else ts_string(name)


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

    def ref_name(self, ref: str) -> str:
        name = ref.rsplit("/", 1)[-1]
        if not IDENTIFIER.match(name):
            raise ValueError(f"component name {name!r} is not a valid TypeScript identifier")
        if name not in self.components:
            raise ValueError(f"unknown component reference {ref!r}")
        return name

    def schema_to_ts(self, schema: Mapping[str, Any], indent: str = "") -> str:
        if UNRESOLVED_EXTENSION in schema:
            return "unknown"
        if "$ref" in schema:
            return self._nullable(self.ref_name(schema["$ref"]), schema)

        if "allOf" in schema:
            parts = [self._parenthesize(self.schema_to_ts(s, indent)) for s in schema["allOf"]]
            return self._nullable(" & ".join(parts), schema)
        for key in ("anyOf", "oneOf"):
            if key in schema:
                parts = [self.schema_to_ts(s, indent) for s in schema[key]]
                return self._nullable(" | ".join(dict.fromkeys(parts)), schema)

        if "enum" in schema:
            # Choices may originate in a set. Sort serialized literals so mixed
            # JSON types remain distinct (e.g. true, 1, and "1").
            literals = sorted(
                {ts_json(value) for value in schema["enum"]},
                key=lambda literal: (literal == "null", literal),
            )
            return self._nullable(" | ".join(literals), schema)

        schema_type = schema.get("type")
        if isinstance(schema_type, list):
            # OpenAPI 3.1 style: ["string", "null"]
            parts = [self.schema_to_ts({**schema, "type": t}, indent) for t in schema_type]
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
            item = self.schema_to_ts(schema.get("items", {}), indent)
            # `T[]` for simple element types, `Array<T>` otherwise, to match the
            # repo's typescript/array-type lint setting.
            array = f"{item}[]" if SIMPLE_ARRAY_ITEM.fullmatch(item) else f"Array<{item}>"
            return self._nullable(array, schema)
        if schema_type == "object" or "properties" in schema:
            return self._nullable(self._object_to_ts(schema, indent), schema)
        return "unknown"

    def _object_to_ts(self, schema: Mapping[str, Any], indent: str) -> str:
        properties: Mapping[str, Any] = schema.get("properties", {})
        additional = schema.get("additionalProperties")
        if not properties:
            if isinstance(additional, Mapping):
                return f"Record<string, {self.schema_to_ts(additional, indent)}>"
            if additional is False:
                return "Record<string, never>"
            return "Record<string, unknown>"

        required = set(schema.get("required", []))
        inner = indent + "  "
        lines = ["{"]
        # Required keys first, then ascending by name, to match the repo's
        # @sentry/sort-interface-keys lint rule (case-sensitive, non-natural).
        ordered = sorted(properties.items(), key=lambda item: (item[0] not in required, item[0]))
        for name, prop in ordered:
            optional = "" if name in required else "?"
            lines.append(f"{inner}{ts_key(name)}{optional}: {self.schema_to_ts(prop, inner)};")
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

    def component_declaration(self, name: str) -> list[str]:
        schema = self.components[name]
        lines = ts_comment(schema.get("description", ""))
        lines.append(f"export type {name} = {self.schema_to_ts(schema)};")
        return lines


def success_response_schemas(operation: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    schemas: list[Mapping[str, Any]] = []
    for code in SUCCESS_CODES:
        content = operation.get("responses", {}).get(code, {}).get("content", {})
        body = content.get("application/json")
        if body and "schema" in body:
            schemas.append(body["schema"])
    return schemas


def success_response_examples(operation: Mapping[str, Any]) -> dict[str, Any]:
    examples: dict[str, Any] = {}
    for code in SUCCESS_CODES:
        content = operation.get("responses", {}).get(code, {}).get("content", {})
        body = content.get("application/json", {})
        for name, example in body.get("examples", {}).items():
            if "value" in example:
                examples[example.get("summary") or name] = example["value"]
    return examples


def collect_operations(spec: Mapping[str, Any], known_routes: set[str]) -> Operations:
    """``{route: {METHOD: operation}}`` for every operation whose route the frontend can name."""
    operations: Operations = {}
    unknown: list[str] = []
    for path, methods in spec["paths"].items():
        route = spec_path_to_route(path)
        if route not in known_routes:
            unknown.append(route)
            continue
        for method in HTTP_METHODS:
            operation = methods.get(method)
            if operation is not None:
                operations.setdefault(route, {})[method.upper()] = operation
    for route in sorted(unknown):
        sys.stderr.write(f"skipping {route}: not in KnownSentryApiUrls\n")
    return operations


def render_contracts(spec: Mapping[str, Any], operations: Operations) -> str:
    components = spec.get("components", {}).get("schemas", {})
    emitter = TypeScriptEmitter(components)

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
    for name in sorted(components):
        lines.extend(emitter.component_declaration(name))
        lines.append("")

    lines.append("export type ApiMapping = {")
    for route in sorted(operations):
        method_lines: list[str] = []
        for method in sorted(operations[route]):
            operation = operations[route][method]
            schemas = success_response_schemas(operation)
            if not schemas:
                continue
            types = list(dict.fromkeys(emitter.schema_to_ts(s, "      ") for s in schemas))
            status = operation.get(PUBLISH_STATUS_EXTENSION, "public")
            label = operation.get("operationId", "")
            method_lines.extend(ts_comment(f"{label} ({status})".strip(), "    "))
            method_lines.append(f"    {method}: {{response: {' | '.join(types)}}};")
        if method_lines:
            lines.append(f"  {ts_string(route)}: {{")
            lines.extend(method_lines)
            lines.append("  };")
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def render_examples(operations: Operations) -> str:
    lines = [
        "/**",
        " * GENERATED FILE. Do not edit manually.",
        " * To update it run `make build-api-contracts`",
        " *",
        " * Response examples attached to backend endpoints via",
        " * `@extend_schema(examples=[OpenApiExample(...)])`, keyed by route, HTTP",
        " * method and example name. `satisfies` checks each body against the",
        " * response type in `ApiMapping`, so an example that drifts from its",
        " * contract fails typecheck.",
        " */",
        "",
        "import type {ApiMapping} from 'sentry/utils/api/apiContracts.generated';",
        "",
        "type ResponseOf<T> = T extends {response: infer R} ? R : never;",
        "",
        "type ApiExamples = {",
        "  [Route in keyof ApiMapping]?: {",
        "    [Method in keyof ApiMapping[Route]]?: Record<string, ResponseOf<ApiMapping[Route][Method]>>;",
        "  };",
        "};",
        "",
        "export const apiExamples = {",
    ]
    for route in sorted(operations):
        method_lines: list[str] = []
        for method in sorted(operations[route]):
            operation = operations[route][method]
            if not success_response_schemas(operation):
                continue
            examples = success_response_examples(operation)
            if not examples:
                continue
            method_lines.append(f"    {method}: {{")
            for name, value in examples.items():
                body = ts_json(value, indent=2)
                body = "\n".join(
                    ("      " + line) if i else line for i, line in enumerate(body.splitlines())
                )
                method_lines.append(f"      {ts_string(name)}: {body},")
            method_lines.append("    },")
        if method_lines:
            lines.append(f"  {ts_string(route)}: {{")
            lines.extend(method_lines)
            lines.append("  },")
    lines.append("} satisfies ApiExamples;")
    lines.append("")
    return "\n".join(lines)


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spec", default=SPEC_PATH)
    parser.add_argument("--known-urls", default=KNOWN_URLS_PATH)
    parser.add_argument("--contracts", default=CONTRACTS_PATH)
    parser.add_argument("--examples", default=EXAMPLES_PATH)
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
    with open(args.examples, "w") as f:
        f.write(render_examples(operations))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
