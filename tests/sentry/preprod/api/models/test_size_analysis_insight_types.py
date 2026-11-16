import types
from typing import TypedDict, Union, get_args, get_origin, get_type_hints, is_typeddict

import pytest
from pydantic import BaseModel

from sentry.api.serializers.rest_framework.base import snake_to_camel_case
from sentry.preprod.api.models.public.size_analysis import (
    AndroidInsightsResponseDict,
    AppleInsightsResponseDict,
)
from sentry.preprod.size_analysis.models import AndroidInsightResults, AppleInsightResults


def _split_none(hint: object) -> tuple[bool, list[object]]:
    if get_origin(hint) in (Union, types.UnionType):
        args = get_args(hint)
        return type(None) in args, [arg for arg in args if arg is not type(None)]
    return False, [hint]


def _assert_type_matches(model_hint: object, response_hint: object, path: str) -> None:
    model_nullable, model_types = _split_none(model_hint)
    response_nullable, response_types = _split_none(response_hint)
    assert model_nullable == response_nullable, f"{path}: nullability differs"
    assert len(model_types) == len(response_types), f"{path}: {model_hint} != {response_hint}"
    for model_type, response_type in zip(model_types, response_types):
        _assert_non_null_type_matches(model_type, response_type, path)


def _assert_non_null_type_matches(model_type: object, response_type: object, path: str) -> None:
    if isinstance(model_type, type) and issubclass(model_type, BaseModel):
        assert is_typeddict(response_type), f"{path}: {response_type} isn't a TypedDict"
        _assert_model_matches(model_type, response_type, path)
    elif get_origin(model_type) is list:
        assert get_origin(response_type) is list, f"{path}: {model_type} != {response_type}"
        (model_item,) = get_args(model_type)
        (response_item,) = get_args(response_type)
        _assert_type_matches(model_item, response_item, f"{path}[]")
    else:
        assert model_type == response_type, f"{path}: {model_type} != {response_type}"


def _assert_model_matches(model: type[BaseModel], response_type: object, path: str) -> None:
    hints = get_type_hints(response_type)
    fields = {snake_to_camel_case(name): field for name, field in model.__fields__.items()}
    assert set(fields) == set(hints), f"{path}: keys differ"
    # dict() includes every field, None or not, so no key is optional.
    assert set(fields) == set(getattr(response_type, "__required_keys__")), (
        f"{path}: some keys are optional"
    )
    for key, field in fields.items():
        model_hint = field.outer_type_ | None if field.allow_none else field.outer_type_
        _assert_type_matches(model_hint, hints[key], f"{path}.{key}")


@pytest.mark.parametrize(
    ("model", "response_type"),
    [
        (AndroidInsightResults, AndroidInsightsResponseDict),
        (AppleInsightResults, AppleInsightsResponseDict),
    ],
)
def test_insight_response_types_match_models(model: type[BaseModel], response_type: type) -> None:
    # The response returns the camelCased dict() of these models, so their keys,
    # value types and nullability must match the response types at every level.
    _assert_model_matches(model, response_type, response_type.__name__)


class _File(BaseModel):
    file_path: str
    size: int | None = None


class _Insight(BaseModel):
    total_savings: int
    files: list[_File]


class _FileResponse(TypedDict):
    filePath: str
    size: int | None


class _InsightResponse(TypedDict):
    totalSavings: int
    files: list[_FileResponse]


class _FileWrongType(TypedDict):
    filePath: int
    size: int | None


class _FileNotNullable(TypedDict):
    filePath: str
    size: int


class _FileMissingKey(TypedDict):
    filePath: str


class _InsightWrongType(TypedDict):
    totalSavings: int
    files: list[_FileWrongType]


class _InsightNotNullable(TypedDict):
    totalSavings: int
    files: list[_FileNotNullable]


class _InsightMissingKey(TypedDict):
    totalSavings: int
    files: list[_FileMissingKey]


def test_matching_types_pass() -> None:
    _assert_model_matches(_Insight, _InsightResponse, "_InsightResponse")


@pytest.mark.parametrize(
    ("response_type", "message"),
    [
        (_InsightWrongType, r"files\[\]\.filePath: <class 'str'> != <class 'int'>"),
        (_InsightNotNullable, r"files\[\]\.size: nullability differs"),
        (_InsightMissingKey, r"files\[\]: keys differ"),
    ],
)
def test_drift_in_a_nested_model_fails(response_type: type, message: str) -> None:
    with pytest.raises(AssertionError, match=message):
        _assert_model_matches(_Insight, response_type, "_InsightResponse")
