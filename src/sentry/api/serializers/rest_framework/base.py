from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypeVar, cast, overload

from django.db.models import Model
from django.utils.text import re_camel_case
from rest_framework.exceptions import ValidationError
from rest_framework.fields import empty
from rest_framework.serializers import ModelSerializer, Serializer
from rest_framework.utils.serializer_helpers import ReturnDict

from sentry.utils import metrics

T = TypeVar("T")


def _classify_key_case(data: dict[str, object]) -> str:
    """Classify the top-level keys of a dict as camel, snake, mixed, or none."""
    has_camel = False
    has_snake = False
    for key in data:
        converted = camel_to_snake_case(key)
        if converted != key:
            has_camel = True
        elif "_" in key:
            has_snake = True
    if has_camel and has_snake:
        return "mixed"
    if has_camel:
        return "camel"
    if has_snake:
        return "snake"

    # Uncertain data could be because the data doesn't have enough information to classify.
    # For example, if the parameters are all single word keys, then they would show up the same
    # whether they are camel or snake case.
    return "uncertain"


def _record_key_case_metric(serializer_name: str, data: dict[str, object]) -> None:
    """Emit a metric classifying the parameter key case of incoming data."""
    key_case = _classify_key_case(data)
    metrics.incr(
        "api.serializer.parameter_key_case",
        tags={
            "key_case": key_case,
            "serializer": serializer_name,
        },
    )


def camel_to_snake_case(value: str) -> str:
    """
    Splits CamelCase and converts to lower case with underscores.
    """
    return re_camel_case.sub(r"_\1", value).strip("_").lower()


def snake_to_camel_case(value: str) -> str:
    """
    Converts a string from snake_case to camelCase
    """
    words = value.strip("_").split("_")
    return words[0].lower() + "".join(word.capitalize() for word in words[1:])


# Nested keys under these containers are third-party identifiers (for example
# Jira field IDs like fixVersions) and must not be case-converted.
_OPAQUE_DICT_KEYS = frozenset({"additional_fields", "additionalFields"})


@overload
def convert_dict_key_case(
    obj: dict[Any, Any], converter: Callable[[str], str]
) -> dict[Any, Any]: ...


@overload
def convert_dict_key_case(obj: list[Any], converter: Callable[[str], str]) -> list[Any]: ...


@overload
def convert_dict_key_case(obj: object, converter: Callable[[str], str]) -> object: ...


def convert_dict_key_case(obj: object, converter: Callable[[str], str]) -> object:
    """
    Recursively converts the keys of a dictionary using the provided converter
    param.

    Nested keys under ``additional_fields`` / ``additionalFields`` are preserved
    verbatim because they are opaque third-party identifiers, not Sentry API
    field names.
    """
    if isinstance(obj, list):
        return [convert_dict_key_case(x, converter) for x in obj]

    if not isinstance(obj, dict):
        return obj

    obj = obj.copy()
    for key in list(obj.keys()):
        converted_key = converter(key)
        if converted_key != key and converted_key in obj:
            raise ValidationError(
                {key: f"{key} collides with {converted_key}, please pass only one value"}
            )
        value = obj.pop(key)
        if key in _OPAQUE_DICT_KEYS and isinstance(value, dict):
            # Convert the container key, keep nested third-party keys as-is.
            obj[converted_key] = value
        else:
            obj[converted_key] = convert_dict_key_case(value, converter)

    return obj


class CamelSnakeSerializer(Serializer[T]):
    """
    Allows parameters to be defined in snake case, but passed as camel case.

    Errors are output in camel case.
    """

    def __init__(self, instance: T | None = None, data: Any = empty, **kwargs: Any) -> None:
        if data is not empty:
            if isinstance(data, dict):
                _record_key_case_metric(type(self).__name__, data)
            data = convert_dict_key_case(data, camel_to_snake_case)
        super().__init__(instance=instance, data=data, **kwargs)

    @property
    def errors(self) -> ReturnDict[str, Any]:
        errors = super().errors
        return cast("ReturnDict[str, Any]", convert_dict_key_case(errors, snake_to_camel_case))


M = TypeVar("M", bound=Model)


class CamelSnakeModelSerializer(ModelSerializer[M]):
    """
    Allows parameters to be defined in snake case, but passed as camel case.

    Errors are output in camel case.
    """

    def __init__(self, instance: M | None = None, data: Any = empty, **kwargs: Any) -> None:
        if data is not empty:
            if isinstance(data, dict):
                _record_key_case_metric(type(self).__name__, data)
            data = convert_dict_key_case(data, camel_to_snake_case)
        super().__init__(instance=instance, data=data, **kwargs)

    @property
    def errors(self) -> ReturnDict[str, Any]:
        errors = super().errors
        return cast("ReturnDict[str, Any]", convert_dict_key_case(errors, snake_to_camel_case))
