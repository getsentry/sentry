from collections.abc import Mapping, Sequence
from typing import Literal, TypeVar, overload

from sentry_conventions.attributes import ATTRIBUTE_METADATA

AttributeSource = Mapping[str, object] | Sequence[Mapping[str, object]]
AttributeValue = str | int | float | bool | list[str] | list[int | float] | list[bool]
AttributeValueKind = Literal[
    "string", "int", "number", "boolean", "string[]", "number[]", "boolean[]"
]
T = TypeVar("T")


def _build_attribute_keys() -> dict[str, tuple[str, ...]]:
    keys = {key: metadata.keys for key, metadata in ATTRIBUTE_METADATA.items()}
    for metadata in ATTRIBUTE_METADATA.values():
        for key in metadata.keys:
            keys.setdefault(key, metadata.keys)
    return keys


_ATTRIBUTE_KEYS = _build_attribute_keys()


def get_attribute(attributes: Mapping[str, T], key: str) -> T | None:
    """
    Retrieve the value for the named attribute in the given `attributes` map,
    checking all names in the attribute's deprecation chain.
    """
    for candidate in _ATTRIBUTE_KEYS.get(key, (key,)):
        if candidate in attributes:
            return attributes[candidate]
    return None


@overload
def get_attribute_value(
    attributes: AttributeSource, key: str, kind: Literal["string"]
) -> str | None: ...


@overload
def get_attribute_value(
    attributes: AttributeSource, key: str, kind: Literal["int"]
) -> int | None: ...


@overload
def get_attribute_value(
    attributes: AttributeSource, key: str, kind: Literal["number"]
) -> int | float | None: ...


@overload
def get_attribute_value(
    attributes: AttributeSource, key: str, kind: Literal["boolean"]
) -> bool | None: ...


@overload
def get_attribute_value(
    attributes: AttributeSource, key: str, kind: Literal["string[]"]
) -> list[str] | None: ...


@overload
def get_attribute_value(
    attributes: AttributeSource, key: str, kind: Literal["number[]"]
) -> list[int | float] | None: ...


@overload
def get_attribute_value(
    attributes: AttributeSource, key: str, kind: Literal["boolean[]"]
) -> list[bool] | None: ...


@overload
def get_attribute_value(
    attributes: AttributeSource, key: str, kind: None = None
) -> AttributeValue | None: ...


@overload
def get_attribute_value(
    attributes: AttributeSource, key: str, kind: AttributeValueKind | None
) -> AttributeValue | None: ...


def get_attribute_value(
    attributes: object, key: str, kind: AttributeValueKind | None = None
) -> AttributeValue | None:
    """
    Retrieve the value for the named attribute, checking all names in the
    attribute's deprecation chain.

    Supports three shapes for `attributes`:
    - `{"http.request.method": "GET"}`
    - `{"http.request.method": {"type": "string", "value": "GET"}}`
    - `[{"name": "http.request.method", "value": "GET"}]`
    """
    if isinstance(attributes, Mapping):
        value = get_attribute(attributes, key)
        if isinstance(value, Mapping):
            value = value.get("value")
    elif isinstance(attributes, Sequence) and not isinstance(attributes, str | bytes):
        entries: dict[str, object] = {}
        for entry in attributes:
            if not isinstance(entry, Mapping):
                continue
            name = entry.get("name")
            if isinstance(name, str) and "value" in entry:
                entries.setdefault(name, entry["value"])
        value = get_attribute(entries, key)
    else:
        return None

    scalar_types: dict[str, tuple[type, ...]] = {
        "string": (str,),
        "number": (int, float),
        "boolean": (bool,),
    }
    if kind is None:
        if isinstance(value, str | int | float | bool) and type(value) in (str, int, float, bool):
            return value
        if isinstance(value, list) and any(
            all(type(item) in types for item in value) for types in ((str,), (int, float), (bool,))
        ):
            return value
    elif kind.endswith("[]"):
        types = scalar_types[kind[:-2]]
        if isinstance(value, list) and all(
            isinstance(item, types) and (kind != "number[]" or not isinstance(item, bool))
            for item in value
        ):
            return value
    elif kind == "string" and isinstance(value, str):
        return value
    elif kind == "boolean" and isinstance(value, bool):
        return value
    elif kind == "int" and isinstance(value, int) and not isinstance(value, bool):
        return value
    elif kind == "number" and isinstance(value, int | float) and not isinstance(value, bool):
        return value
    return None
