from __future__ import annotations

from typing import TypeVar

import orjson
import pydantic
from pydantic.tools import parse_obj_as
from rest_framework import serializers
from rest_framework.request import Request

T = TypeVar("T")


def parse_request_with_pydantic(request: Request, model: type[T]) -> T:
    try:
        j = orjson.loads(request.body)
    except orjson.JSONDecodeError:
        raise serializers.ValidationError("Invalid json")
    try:
        # When we have Pydantic 2 availble TypeAdapter on the model
        # can be used instead of parse_obj_as
        return parse_obj_as(model, j)
    except pydantic.ValidationError:
        raise serializers.ValidationError(
            "Could not parse request with Pydantic model {model.__name__}"
        )
