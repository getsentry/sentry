import types
from typing import Union, cast, get_args, get_origin, get_type_hints, is_typeddict

import pytest
from pydantic import BaseModel

from sentry.api.serializers.rest_framework.base import snake_to_camel_case
from sentry.preprod.api.models.public.size_analysis import (
    AndroidInsightsResponseDict,
    AppleInsightsResponseDict,
)
from sentry.preprod.size_analysis.models import AndroidInsightResults, AppleInsightResults


def _inner_typeddict(hint: object) -> type | None:
    if is_typeddict(hint):
        return cast(type, hint)
    if get_origin(hint) in (list, Union, types.UnionType):
        for arg in get_args(hint):
            if (inner := _inner_typeddict(arg)) is not None:
                return inner
    return None


def _assert_keys_match(model: type[BaseModel], response_type: type, path: str) -> None:
    hints = get_type_hints(response_type)
    model_keys = {snake_to_camel_case(name) for name in model.__fields__}
    assert model_keys == set(hints), path

    for name, field in model.__fields__.items():
        if isinstance(field.type_, type) and issubclass(field.type_, BaseModel):
            key = snake_to_camel_case(name)
            inner = _inner_typeddict(hints[key])
            assert inner is not None, f"{path}.{key}"
            _assert_keys_match(field.type_, inner, f"{path}.{key}")


@pytest.mark.parametrize(
    ("model", "response_type"),
    [
        (AndroidInsightResults, AndroidInsightsResponseDict),
        (AppleInsightResults, AppleInsightsResponseDict),
    ],
)
def test_insight_response_types_match_models(model: type[BaseModel], response_type: type) -> None:
    # The response returns the camelCased dict() of these models, so their fields
    # must match the response types at every level.
    _assert_keys_match(model, response_type, response_type.__name__)
