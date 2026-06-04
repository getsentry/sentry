from __future__ import annotations

from typing import TypeVar

from django.db.models import Model
from django.utils.text import re_camel_case
from rest_framework.exceptions import ValidationError
from rest_framework.fields import empty
from rest_framework.serializers import ModelSerializer, Serializer

from sentry.utils import metrics

T = TypeVar("T")


def _classify_key_case(data: dict) -> str:
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


def _record_key_case_metric(serializer_name: str, data: dict) -> None:
    """Emit a metric classifying the parameter key case of incoming data."""
    key_case = _classify_key_case(data)
    metrics.incr(
        "api.serializer.parameter_key_case",
        tags={
            "key_case": key_case,
            "serializer": serializer_name,
        },
    )


def camel_to_snake_case(value):
    """
    Splits CamelCase and converts to lower case with underscores.
    """
    return re_camel_case.sub(r"_\1", value).strip("_").lower()


def snake_to_camel_case(value):
    """
    Converts a string from snake_case to camelCase
    """
    words = value.strip("_").split("_")
    return words[0].lower() + "".join(word.capitalize() for word in words[1:])


def convert_dict_key_case(obj, converter):
    """
    Recursively converts the keys of a dictionary using the provided converter
    param.
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
        obj[converted_key] = convert_dict_key_case(obj.pop(key), converter)

    return obj


class CamelSnakeSerializer(Serializer[T]):
    """
    Allows parameters to be defined in snake case, but passed as camel case.

    Errors are output in camel case.
    """

    def __init__(self, instance=None, data=empty, **kwargs):
        if data is not empty:
            if isinstance(data, dict):
                _record_key_case_metric(type(self).__name__, data)
            data = convert_dict_key_case(data, camel_to_snake_case)
        super().__init__(instance=instance, data=data, **kwargs)

    @property
    def errors(self):
        errors = super().errors
        return convert_dict_key_case(errors, snake_to_camel_case)


M = TypeVar("M", bound=Model)


class CamelSnakeModelSerializer(ModelSerializer[M]):
    """
    Allows parameters to be defined in snake case, but passed as camel case.

    Errors are output in camel case.
    """

    def __init__(self, instance=None, data=empty, **kwargs):
        if data is not empty:
            if isinstance(data, dict):
                _record_key_case_metric(type(self).__name__, data)
            data = convert_dict_key_case(data, camel_to_snake_case)
        super().__init__(instance=instance, data=data, **kwargs)

    @property
    def errors(self):
        errors = super().errors
        return convert_dict_key_case(errors, snake_to_camel_case)
