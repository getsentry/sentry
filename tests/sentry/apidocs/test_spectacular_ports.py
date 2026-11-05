from typing import Annotated, NotRequired, ReadOnly, TypedDict

from sentry.apidocs.descriptions import ApiDescription
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
