import re
from typing import Annotated, NotRequired, ReadOnly, TypedDict

import pytest

from sentry.apidocs.descriptions import ApiDescription, ApiSchema
from sentry.apidocs.formats import (
    GIT_REF_MAX_LENGTH,
    GIT_REF_PATTERN_OPTIONAL_EMPTY,
    ApiFormat,
    GitRef,
    IsoDateTime,
    Url,
)
from sentry.apidocs.spectacular_ports import resolve_type_hint


class Marker:
    """Unrelated Annotated metadata, which the schema ignores."""


class NestedResponse(TypedDict):
    """Nested object docstring."""

    zz: str


class DescribedResponse(TypedDict):
    plain: int
    described: Annotated[int, ApiDescription("An integer")]
    nullable: Annotated[str | None, ApiDescription("A nullable string")]
    items: Annotated[list[int], ApiDescription("A list")]
    nested: Annotated[NestedResponse, ApiDescription("A nested object")]
    other_metadata: Annotated[int, Marker()]
    both_metadata: Annotated[int, Marker(), ApiDescription("With other metadata")]
    not_required: NotRequired[Annotated[bool, ApiDescription("An optional flag")]]
    read_only: ReadOnly[Annotated[str, ApiDescription("A read-only string")]]
    string_annotation: "Annotated[int, ApiDescription('From a string annotation')]"


FunctionalResponse = TypedDict(
    "FunctionalResponse",
    {"event.type": Annotated[str, ApiDescription("A key that isn't an identifier")]},
)


def test_annotated_field_descriptions() -> None:
    schema = resolve_type_hint(DescribedResponse)

    assert schema["properties"] == {
        "plain": {"type": "integer"},
        "described": {"type": "integer", "description": "An integer"},
        "nullable": {"type": "string", "nullable": True, "description": "A nullable string"},
        "items": {"type": "array", "items": {"type": "integer"}, "description": "A list"},
        "nested": {
            "type": "object",
            "properties": {"zz": {"type": "string"}},
            "required": ["zz"],
            # The field description replaces the nested TypedDict's docstring.
            "description": "A nested object",
        },
        "other_metadata": {"type": "integer"},
        "both_metadata": {"type": "integer", "description": "With other metadata"},
        "not_required": {"type": "boolean", "description": "An optional flag"},
        "read_only": {"type": "string", "description": "A read-only string"},
        "string_annotation": {"type": "integer", "description": "From a string annotation"},
    }
    assert "not_required" not in schema["required"]
    assert sorted(schema["required"]) == sorted(
        k for k in DescribedResponse.__annotations__ if k != "not_required"
    )


def test_annotated_field_without_description_matches_plain_type() -> None:
    class Plain(TypedDict):
        a: int
        b: NotRequired[NestedResponse]

    class WithMarker(TypedDict):
        a: Annotated[int, Marker()]
        b: NotRequired[Annotated[NestedResponse, Marker()]]

    assert resolve_type_hint(WithMarker) == resolve_type_hint(Plain)


def test_functional_typed_dict_field_description() -> None:
    assert resolve_type_hint(FunctionalResponse)["properties"] == {
        "event.type": {"type": "string", "description": "A key that isn't an identifier"},
    }


class EmptyResponse(TypedDict):
    """Always an empty object."""


def test_typed_dict_without_fields_is_an_empty_object() -> None:
    assert resolve_type_hint(EmptyResponse) == {
        "type": "object",
        "description": "Always an empty object.",
        "maxProperties": 0,
    }


class FormattedResponse(TypedDict):
    created: Annotated[IsoDateTime, ApiDescription("A timestamp")]
    expires: IsoDateTime | None
    link: Url
    links: list[Url]
    ref: GitRef | None
    custom: Annotated[str, ApiFormat(format="email", max_length=10)]
    optional: NotRequired[Annotated[Url, ApiDescription("An optional link")]]


def test_annotated_field_formats() -> None:
    assert resolve_type_hint(FormattedResponse)["properties"] == {
        "created": {"type": "string", "format": "date-time", "description": "A timestamp"},
        "expires": {"type": "string", "format": "date-time", "nullable": True},
        "link": {"type": "string", "format": "uri"},
        "links": {"type": "array", "items": {"type": "string", "format": "uri"}},
        "ref": {
            "type": "string",
            "pattern": GIT_REF_PATTERN_OPTIONAL_EMPTY,
            "maxLength": GIT_REF_MAX_LENGTH,
            "nullable": True,
        },
        "custom": {"type": "string", "format": "email", "maxLength": 10},
        "optional": {"type": "string", "format": "uri", "description": "An optional link"},
    }


class SchemaResponse(TypedDict):
    built: Annotated[
        object, ApiDescription("Built elsewhere"), ApiSchema(lambda: {"type": "integer"})
    ]


def test_annotated_field_schema_replaces_the_generated_one() -> None:
    assert resolve_type_hint(SchemaResponse)["properties"] == {
        "built": {"type": "integer", "description": "Built elsewhere"},
    }


@pytest.mark.parametrize(
    "ref",
    ["", "main", "feature/xyz", "refs/heads/main", "pull/123/merge", "release-1.2.3", "HEAD"],
)
def test_git_ref_pattern_accepts(ref: str) -> None:
    assert re.match(GIT_REF_PATTERN_OPTIONAL_EMPTY, ref)


@pytest.mark.parametrize(
    "ref",
    [
        "@",
        "/main",
        "main/",
        "main.",
        "a//b",
        "a..b",
        ".hidden",
        "a/.b",
        "a.lock",
        "a.lock/b",
        "a@{b",
        "a b",
        "a\tb",
        "a~b",
        "a^b",
        "a:b",
        "a?b",
        "a*b",
        "a[b",
        "a\\b",
    ],
)
def test_git_ref_pattern_rejects(ref: str) -> None:
    assert not re.match(GIT_REF_PATTERN_OPTIONAL_EMPTY, ref)
