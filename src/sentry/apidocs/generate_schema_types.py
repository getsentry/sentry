"""
Generates Python types from the JSON Schemas that configs are validated with.

The JSON Schemas stay the source of truth. The API schema is built from them when the
docs are built (see `sentry.apidocs.json_schemas`), so it keeps their constraints, and
this module writes matching TypedDicts, unions and Literals into checked-in files, so
mypy checks the code that reads and returns the configs. After changing one of the
schemas, run:

    python -m sentry.apidocs.generate_schema_types

`tests/sentry/apidocs/test_generate_schema_types.py` fails when a file is out of date.

Each schema gives a type for the data as it's stored and validated. Where the API
camelCases the keys, `<Name>Response` is the type of the data the API returns.
"""

from __future__ import annotations

import difflib
import json  # noqa: S003
import keyword
import re
import subprocess
import sys
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass, field, replace
from enum import Enum
from pathlib import Path
from typing import Any, Literal

COMMAND = "python -m sentry.apidocs.generate_schema_types"
SRC_ROOT = Path(__file__).resolve().parents[2]

OPEN_OBJECT = "The schema leaves this object open, so it can have any keys."
OPEN_KEYS = "The schema allows keys that aren't listed here."
UNCONSTRAINED = "The schema doesn't constrain this value."
UNCONSTRAINED_ITEMS = "The schema doesn't constrain the items."

# Keywords that only constrain values, or that the types can't express, such as which
# properties are required together. The API schema keeps them.
_IGNORED_KEYWORDS = frozenset(
    {
        "$schema",
        "$id",
        "title",
        "description",
        "default",
        "examples",
        "pattern",
        "format",
        "minimum",
        "maximum",
        "exclusiveMinimum",
        "exclusiveMaximum",
        "multipleOf",
        "minLength",
        "maxLength",
        "minItems",
        "maxItems",
        "uniqueItems",
        "minProperties",
        "maxProperties",
        "definitions",
        "$defs",
        "not",
        "if",
        "then",
        "else",
        # Not a JSON Schema keyword, but some schemas use it as a note.
        "optional",
    }
)
_SHAPE_KEYWORDS = frozenset(
    {
        "$ref",
        "type",
        "enum",
        "const",
        "properties",
        "required",
        "additionalProperties",
        "items",
        "anyOf",
        "oneOf",
        "allOf",
    }
)
_PRIMITIVES = {
    "string": "str",
    "integer": "int",
    "number": "float",
    "boolean": "bool",
    "null": "None",
}
_DEFINITION_PREFIXES = ("#/definitions/", "#/$defs/")


class UnsupportedSchemaError(ValueError):
    pass


@dataclass(frozen=True)
class Root:
    """
    A named type generated from one JSON Schema.

    `forms` picks the types to generate: `stored` for the data as it's validated,
    `response` for the data with camelCased keys, as the API returns it, or `both`. The
    response type is `<name>Response` when camelCasing renames a key, otherwise the
    stored type is used for both.
    """

    name: str
    schema: Mapping[str, Any]
    source: str
    forms: Literal["stored", "response", "both"] = "stored"
    definitions: Mapping[str, Any] = field(default_factory=dict)
    definition_prefix: str = ""


@dataclass(frozen=True)
class Union:
    """A union of the stored or the response types of other roots."""

    name: str
    members: Sequence[str]
    form: Literal["stored", "response"]
    source: str


@dataclass(frozen=True)
class GeneratedFile:
    path: str
    description: str
    roots: Callable[[], Sequence[Root | Union]]

    @property
    def absolute_path(self) -> Path:
        return SRC_ROOT / self.path


@dataclass(frozen=True)
class _Context:
    definitions: Mapping[str, Any]
    prefix: str
    camel: bool


def _camel(name: str) -> str:
    # Imported here so that the module can be run before Django is configured.
    from sentry.api.serializers.rest_framework.base import snake_to_camel_case

    return snake_to_camel_case(name)


def _pascal(name: str) -> str:
    return "".join(part[0].upper() + part[1:] for part in re.split(r"[^0-9A-Za-z]+", name) if part)


def _literal(value: Any) -> str:
    if isinstance(value, Enum):
        # Schemas can list enum members, which are validated and stored as their values.
        value = value.value
    if isinstance(value, (str, bool, int, float)):
        return json.dumps(value) if isinstance(value, str) else repr(value)
    raise UnsupportedSchemaError(f"Can't write {value!r} as a Literal")


def _split_union(expression: str) -> list[str]:
    parts, depth, start = [], 0, 0
    for index, char in enumerate(expression):
        depth += char in "[("
        depth -= char in "])"
        if depth == 0 and expression.startswith(" | ", index):
            parts.append(expression[start:index])
            start = index + 3
    parts.append(expression[start:])
    return parts


def _union(expressions: Iterable[str]) -> str:
    parts: list[str] = []
    for expression in expressions:
        for part in _split_union(expression):
            if part not in parts:
                parts.append(part)
    if "Any" in parts:
        return "Any"
    # None last, the way unions are usually written.
    return " | ".join(sorted(parts, key=lambda part: part == "None"))


def _definition_name(ref: str) -> str:
    for prefix in _DEFINITION_PREFIXES:
        if ref.startswith(prefix):
            return ref[len(prefix) :]
    raise UnsupportedSchemaError(f"Unsupported reference {ref}")


def _renames_keys(schema: Any, definitions: Mapping[str, Any], seen: frozenset[str]) -> bool:
    """Whether camelCasing changes a property name anywhere in the schema."""
    if isinstance(schema, list):
        return any(_renames_keys(item, definitions, seen) for item in schema)
    if not isinstance(schema, Mapping):
        return False
    ref = schema.get("$ref")
    if isinstance(ref, str):
        name = _definition_name(ref)
        if name not in seen and _renames_keys(definitions[name], definitions, seen | {name}):
            return True
    properties = schema.get("properties")
    if isinstance(properties, Mapping) and any(_camel(prop) != prop for prop in properties):
        return True
    return any(
        _renames_keys(value, definitions, seen)
        for key, value in schema.items()
        if key not in ("definitions", "$defs")
    )


def _comments(lines: Iterable[str], indent: str = "") -> str:
    return "".join(
        f"{indent}# {line}".rstrip() + "\n"
        for text in lines
        for line in (text.splitlines() or [""])
    )


class _Writer:
    def __init__(self) -> None:
        self.blocks: dict[str, str] = {}
        self.comments: dict[str, str] = {}
        self.response_names: dict[str, str] = {}
        self.in_progress: set[str] = set()

    def add_root(self, root: Root) -> None:
        definitions = {
            **root.definitions,
            **root.schema.get("definitions", {}),
            **root.schema.get("$defs", {}),
        }
        context = _Context(definitions, root.definition_prefix, camel=False)
        if root.forms in ("stored", "both"):
            name = self._named(root.schema, root.name, context)
            self.comments.setdefault(name, root.source)
        if root.forms in ("response", "both"):
            name = self._named(root.schema, root.name, replace(context, camel=True))
            self.comments.setdefault(name, root.source)
            self.response_names[root.name] = name

    def add_union(self, union: Union) -> None:
        names = (
            [self.response_names[member] for member in union.members]
            if union.form == "response"
            else union.members
        )
        self._add(union.name, f"{union.name}: TypeAlias = {_union(names)}\n")
        self.comments[union.name] = union.source

    def render(self) -> str:
        return "\n\n".join(
            _comments([self.comments[name]]) + block if name in self.comments else block
            for name, block in self.blocks.items()
        )

    def _add(self, name: str, block: str) -> None:
        if self.blocks.get(name, block) != block:
            raise UnsupportedSchemaError(f"{name} would be generated from two different schemas")
        self.blocks[name] = block

    def _narrow(self, context: _Context, schema: Mapping[str, Any]) -> _Context:
        # Parts that camelCasing doesn't change reuse the stored types.
        if context.camel and not _renames_keys(schema, context.definitions, frozenset()):
            return replace(context, camel=False)
        return context

    def _type_name(self, hint: str, context: _Context) -> str:
        return f"{hint}Response" if context.camel else hint

    def _named(self, schema: Mapping[str, Any], hint: str, context: _Context) -> str:
        context = self._narrow(context, schema)
        name = self._type_name(hint, context)
        notes: list[str] = []
        expression = self._expression(schema, hint, context, notes)
        if expression != name:
            self._add(name, f"{_comments(notes)}{name}: TypeAlias = {expression}\n")
        return name

    def _expression(
        self, schema: Mapping[str, Any] | bool, hint: str, context: _Context, notes: list[str]
    ) -> str:
        if schema is True or (isinstance(schema, Mapping) and not set(schema) & _SHAPE_KEYWORDS):
            notes.append(UNCONSTRAINED)
            return "Any"
        if not isinstance(schema, Mapping):
            raise UnsupportedSchemaError(f"{hint}: unsupported schema {schema!r}")
        unknown = set(schema) - _SHAPE_KEYWORDS - _IGNORED_KEYWORDS
        if unknown:
            raise UnsupportedSchemaError(f"{hint}: unsupported keywords {sorted(unknown)}")
        context = self._narrow(context, schema)

        if isinstance(ref := schema.get("$ref"), str):
            return self._reference(ref, context)
        if "const" in schema:
            return _literal_union([schema["const"]])
        if "enum" in schema:
            return _literal_union(schema["enum"])

        properties = schema.get("properties")
        if not isinstance(properties, Mapping):
            # Next to properties, these only add rules, such as which properties are
            # required together, so they're skipped there.
            for combinator in ("anyOf", "oneOf"):
                if combinator in schema:
                    if "type" in schema:
                        raise UnsupportedSchemaError(f"{hint}: type next to {combinator}")
                    return _union(
                        self._expression(branch, f"{hint}{index}", context, notes)
                        for index, branch in enumerate(schema[combinator], 1)
                    )
            if "allOf" in schema:
                raise UnsupportedSchemaError(f"{hint}: allOf without properties")

        types = schema.get("type", "object" if isinstance(properties, Mapping) else None)
        if types is None:
            notes.append(UNCONSTRAINED)
            return "Any"
        return _union(
            self._type(kind, schema, hint, context, notes)
            for kind in ([types] if isinstance(types, str) else types)
        )

    def _type(
        self,
        kind: str,
        schema: Mapping[str, Any],
        hint: str,
        context: _Context,
        notes: list[str],
    ) -> str:
        if kind in _PRIMITIVES:
            return _PRIMITIVES[kind]
        if kind == "array":
            items = schema.get("items")
            if isinstance(items, list):
                # JSON has no tuples, so the decoded value is a list of any of the types.
                return "list[{}]".format(
                    _union(
                        self._expression(item, f"{hint}Item{index}", context, notes)
                        for index, item in enumerate(items, 1)
                    )
                )
            if items is None:
                notes.append(UNCONSTRAINED_ITEMS)
                return "list[Any]"
            return f"list[{self._expression(items, f'{hint}Item', context, notes)}]"
        if kind == "object":
            extra = schema.get("additionalProperties")
            if (
                isinstance(schema.get("properties"), Mapping)
                or extra is False
                or schema.get("maxProperties") == 0
            ):
                return self._typed_dict(schema, hint, context)
            if isinstance(extra, Mapping):
                return f"dict[str, {self._expression(extra, f'{hint}Value', context, notes)}]"
            notes.append(OPEN_OBJECT)
            return "dict[str, Any]"
        raise UnsupportedSchemaError(f"{hint}: unsupported type {kind}")

    def _reference(self, ref: str, context: _Context) -> str:
        definition = _definition_name(ref)
        schema = context.definitions[definition]
        context = self._narrow(context, schema)
        hint = f"{context.prefix}{_pascal(definition)}"
        name = self._type_name(hint, context)
        if name in self.blocks:
            return name
        if name in self.in_progress:
            # A definition that refers back to itself.
            return f'"{name}"'
        self.in_progress.add(name)
        try:
            return self._named(schema, hint, context)
        finally:
            self.in_progress.discard(name)

    def _typed_dict(self, schema: Mapping[str, Any], hint: str, context: _Context) -> str:
        name = self._type_name(hint, context)
        required = set(schema.get("required", ()))
        notes: list[str] = []
        fields: list[tuple[str, str, list[str]]] = []
        for prop, spec in schema.get("properties", {}).items():
            field_notes: list[str] = []
            expression = self._expression(spec, f"{hint}{_pascal(prop)}", context, field_notes)
            if prop not in required:
                expression = f"NotRequired[{expression}]"
            key = _camel(prop) if context.camel else prop
            fields.append((key, expression, field_notes))
        if fields and schema.get("additionalProperties") is not False:
            notes.append(OPEN_KEYS)

        description = schema.get("description")
        if all(key.isidentifier() and not keyword.iskeyword(key) for key, _, _ in fields):
            body = "".join(
                f"{_comments(field_notes, '    ')}    {key}: {expression}\n"
                for key, expression, field_notes in fields
            )
            docstring = f'    """{description}"""\n' if description else ""
            if not body and not docstring:
                body = "    pass\n"
            block = (
                f"{_comments(notes)}class {name}(TypedDict):\n"
                f"{docstring}{chr(10) if docstring and body else ''}{body}"
            )
        else:
            entries = "".join(
                f"{_comments(field_notes, '        ')}        {json.dumps(key)}: {expression},\n"
                for key, expression, field_notes in fields
            )
            block = (
                f"{_comments([description] if description else [])}{_comments(notes)}"
                f'{name} = TypedDict(\n    "{name}",\n    {{\n{entries}    }},\n)\n'
            )
        self._add(name, block)
        return name


def _literal_union(values: Sequence[Any]) -> str:
    literals = [_literal(value) for value in values if value is not None]
    parts = [f"Literal[{', '.join(literals)}]"] if literals else []
    if None in values:
        parts.append("None")
    return _union(parts)


def generate(file: GeneratedFile) -> str:
    """The formatted contents of a generated file."""
    writer = _Writer()
    for root in file.roots():
        if isinstance(root, Union):
            writer.add_union(root)
        else:
            writer.add_root(root)
    body = writer.render()
    names = ("Any", "Literal", "NotRequired", "TypeAlias", "TypedDict")
    used = [name for name in names if re.search(rf"\b{name}\b", body)]
    header = _comments(
        [
            f"Generated by `{COMMAND}`. Do not edit it by hand.",
            "",
            file.description,
            "To change a type, change its JSON Schema and run the command again.",
            "tests/sentry/apidocs/test_generate_schema_types.py fails when this file is stale.",
        ]
    )
    source = f"{header}\nfrom typing import {', '.join(used)}\n\n\n{body}"
    return _format(source, file.absolute_path)


def _format(source: str, path: Path) -> str:
    # The import sorter decides the blank lines after the imports, so it runs too.
    for command in (["format"], ["check", "--fix", "--quiet", "--select", "I"]):
        source = subprocess.run(
            [sys.executable, "-m", "ruff", *command, "--stdin-filename", str(path), "-"],
            input=source,
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    return source


def stale_files(files: Iterable[GeneratedFile] | None = None) -> dict[str, str]:
    """A diff for each generated file whose checked-in contents are out of date."""
    stale = {}
    for file in FILES if files is None else files:
        expected = generate(file)
        path = file.absolute_path
        current = path.read_text() if path.exists() else ""
        if current != expected:
            stale[file.path] = "".join(
                difflib.unified_diff(
                    current.splitlines(keepends=True),
                    expected.splitlines(keepends=True),
                    f"{file.path} (checked in)",
                    f"{file.path} (generated)",
                )
            )
    return stale


def _workflow_engine_roots() -> list[Root | Union]:
    from sentry.grouping.grouptype import ErrorGroupType
    from sentry.workflow_engine.endpoints.serializers import response_schemas
    from sentry.workflow_engine.models import Workflow

    roots: list[Root | Union] = []
    conditions = []
    for condition, schema in response_schemas.condition_comparison_sources():
        conditions.append(name := f"{_pascal(condition)}Comparison")
        roots.append(
            Root(name, schema, f"comparison_json_schema of the {condition} condition", "both")
        )
    roots += [
        Root(
            "OperatorComparison",
            response_schemas.OPERATOR_COMPARISON_SCHEMA,
            "Plain value that operator conditions, such as gt or eq, compare against",
            "response",
        ),
        Union("ConditionComparison", conditions, "stored", "Any condition's comparison"),
        Union(
            "ConditionComparisonResponse",
            ["OperatorComparison", *conditions],
            "response",
            "Any condition's comparison, as the API returns it",
        ),
    ]

    actions = []
    for action, schema in response_schemas.action_config_sources(api=False):
        actions.append(name := f"{_pascal(action)}ActionConfig")
        roots.append(Root(name, schema, f"config_schema of the {action} action handler"))
    for action, schema in response_schemas.action_config_sources(api=True):
        roots.append(
            Root(
                f"{_pascal(action)}ActionConfig",
                schema,
                f"Config of the {action} action handler, as its config transformer shows it",
                "response",
            )
        )
    data = []
    for action, schema in response_schemas.action_data_sources():
        data.append(name := f"{_pascal(action)}ActionData")
        roots.append(Root(name, schema, f"data_schema of the {action} action handler", "both"))
    roots += [
        Union("ActionConfig", actions, "stored", "Any action's config"),
        Union(
            "ActionConfigResponse",
            actions,
            "response",
            "Any action's config, as the API returns it",
        ),
        Union("ActionData", data, "stored", "Any action's data"),
        Union("ActionDataResponse", data, "response", "Any action's data, as the API returns it"),
    ]

    detectors = []
    for slug, schema in response_schemas.detector_config_sources():
        detectors.append(name := f"{_pascal(slug)}DetectorConfig")
        roots.append(
            Root(
                name,
                schema,
                f"config_schema of the {slug} detector",
                "stored" if slug == ErrorGroupType.slug else "both",
            )
        )
    roots += [
        Root(
            "EmptyDetectorConfig",
            response_schemas.EMPTY_DETECTOR_CONFIG_SCHEMA,
            "Config the API returns for detector types without a config schema",
            "response",
        ),
        Root(
            "ErrorDetectorProjectOptions",
            response_schemas.error_detector_options_schema(),
            "Project options the API returns as the config of error detectors",
            "response",
        ),
        Union("DetectorConfig", detectors, "stored", "Any detector's config"),
        Union(
            "DetectorConfigResponse",
            [
                "EmptyDetectorConfig",
                "ErrorDetectorProjectOptions",
                *(
                    name
                    for name in detectors
                    if name != f"{_pascal(ErrorGroupType.slug)}DetectorConfig"
                ),
            ],
            "response",
            "Any detector's config, as the API returns it",
        ),
        Root("WorkflowConfig", Workflow.config_schema, "Workflow.config_schema", "both"),
    ]
    return roots


def _sentry_app_roots() -> list[Root | Union]:
    from sentry.sentry_apps.api.parsers.schema import ELEMENT_TYPES, SCHEMA
    from sentry.sentry_apps.api.serializers.response_schemas import component_definitions

    definitions = component_definitions()
    app_schema = {key: value for key, value in SCHEMA.items() if key != "definitions"}
    elements = {"anyOf": [{"$ref": f"#/definitions/{element}"} for element in ELEMENT_TYPES]}
    return [
        Root(
            "SentryAppSchema",
            app_schema,
            "UI schema of a Sentry App",
            definitions=definitions,
            definition_prefix="SentryApp",
        ),
        Root(
            "SentryAppComponentSchema",
            elements,
            "UI schema of one Sentry App component",
            definitions=definitions,
            definition_prefix="SentryApp",
        ),
    ]


FILES = (
    GeneratedFile(
        "sentry/workflow_engine/generated_schema_types.py",
        "Types of the condition comparisons, action configs and data, and detector and\n"
        "workflow configs, from the JSON Schemas in their registries. See\n"
        "sentry.workflow_engine.endpoints.serializers.response_schemas.",
        _workflow_engine_roots,
    ),
    GeneratedFile(
        "sentry/sentry_apps/generated_schema_types.py",
        "Types of Sentry App UI schemas, from SCHEMA in sentry.sentry_apps.api.parsers.schema\n"
        "with the keys that sentry.sentry_apps.api.serializers.response_schemas adds when\n"
        "Sentry prepares a component.",
        _sentry_app_roots,
    ),
)


def main() -> int:
    from sentry.runner import configure

    configure(skip_service_validation=True)
    for file in FILES:
        file.absolute_path.write_text(generate(file))
        sys.stdout.write(f"wrote {file.path}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
