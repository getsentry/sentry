import re
from typing import Final, Literal

from pydantic import BaseModel, ValidationError, validator
from rest_framework.exceptions import ParseError
from rest_framework.request import Request

from sentry.api.utils import handle_query_errors
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.constants import FUNCTION_PATTERN
from sentry.search.events.fields import (
    FunctionArg,
    IntArg,
    InvalidFunctionArgument,
    NumberRange,
    parse_arguments,
)

FILL_MODE_LOCF: Final = "locf"
FILL_MODE_ZERO: Final = "zero"
FILL_MODE_LINEAR: Final = "linear"

SMOOTH_MODE_SMA: Final = "sma"
SMOOTH_MODE_EMA: Final = "ema"


class FillTransformation(BaseModel):
    mode: Literal["locf", "zero", "linear"]

    class Config:
        extra = "forbid"
        frozen = True
        validate_all = True


class BaseSmoothTransformation(BaseModel):
    mode: Literal["sma", "ema"]
    window_size: int

    class Config:
        extra = "forbid"
        frozen = True
        validate_all = True

    @validator("window_size", pre=True)
    def validate_window_size(cls, value: object) -> int:
        if not isinstance(value, int) or isinstance(value, bool):
            raise ValueError("Window size must be an integer.")
        if value < 1:
            raise ValueError("Window size must be positive.")
        return value


class SmaSmoothTransformation(BaseSmoothTransformation):
    mode: Literal["sma"]


class EmaSmoothTransformation(BaseSmoothTransformation):
    mode: Literal["ema"]
    smoothing_factor: float | None = None

    @validator("smoothing_factor", pre=True)
    def validate_smoothing_factor(cls, value: object) -> float | None:
        if value is None:
            return None
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError("Smoothing factor must be a number.")
        if not 0 < value <= 1:
            raise ValueError("Smoothing factor must be greater than zero and at most one.")
        return float(value)


Transformation = FillTransformation | SmaSmoothTransformation | EmaSmoothTransformation

_TRANSFORMATIONS: dict[
    str,
    tuple[
        type[FillTransformation] | type[SmaSmoothTransformation] | type[EmaSmoothTransformation],
        tuple[FunctionArg, ...],
    ],
] = {
    "fill": (FillTransformation, (FunctionArg("mode"),)),
    "smooth": (
        SmaSmoothTransformation,
        (FunctionArg("mode"), IntArg("window_size", negative=True)),
    ),
}


def parse_transformation(value: str) -> Transformation:
    match = FUNCTION_PATTERN.fullmatch(value)
    if match is None or match.group("alias") is not None:
        raise InvalidSearchQuery(f"{value} is not a valid transformation")

    function = match.group("function")
    definition = _TRANSFORMATIONS.get(function)
    if definition is None:
        raise InvalidSearchQuery(f"{function} is not a valid transformation function")

    model, argument_definitions = definition
    arguments = parse_arguments(function, match.group("columns"))
    if function == "fill" and len(arguments) != 1:
        raise InvalidSearchQuery(f"{value}: argument count must be 1")
    if function == "smooth":
        if arguments and arguments[0] == SMOOTH_MODE_EMA:
            if len(arguments) not in (2, 3):
                raise InvalidSearchQuery(f"{value}: argument count must be 2 or 3")
            model = EmaSmoothTransformation
            argument_definitions += (NumberRange("smoothing_factor", None, None),)
        elif len(arguments) != 2:
            raise InvalidSearchQuery(f"{value}: argument count must be 2")

    config: dict[str, object] = {}
    for argument, raw_value in zip(argument_definitions, arguments):
        try:
            config[argument.name] = argument.normalize(raw_value, {}, None)
        except InvalidFunctionArgument as error:
            raise InvalidSearchQuery(f"{value}: {argument.name} argument invalid: {error}")

    try:
        return model.parse_obj(config)
    except ValidationError as error:
        detail = error.errors()[0]
        message = detail["msg"]
        if detail["type"] == "value_error.const":
            permitted = detail["ctx"]["permitted"]
            if function == "smooth":
                permitted = (SMOOTH_MODE_SMA, SMOOTH_MODE_EMA)
            message = f"expected one of {', '.join(permitted)}"
        raise InvalidSearchQuery(f"{value}: {detail['loc'][0]} argument invalid: {message}")


def get_transformations(request: Request) -> dict[int, list[Transformation]]:
    """Parse ordered transformations by zero-based request yAxis position."""
    transformations: dict[int, list[Transformation]] = {}
    axis_count = len(request.GET.getlist("yAxis", ["count()"]))
    for key, values in request.GET.lists():
        if key != "transformations" and not key.startswith("transformations["):
            continue
        match = re.fullmatch(r"transformations\[(0|[1-9][0-9]*)\]", key)
        if match is None:
            raise ParseError(detail="Invalid transformations index")
        try:
            index = int(match.group(1))
        except ValueError:
            raise ParseError(detail="Invalid transformations index")
        if index >= axis_count:
            raise ParseError(detail="transformations index must match a yAxis position")
        with handle_query_errors():
            transformations[index] = [parse_transformation(value) for value in values]
    return transformations
