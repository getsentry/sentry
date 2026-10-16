import re
from collections.abc import Sequence
from dataclasses import dataclass
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


@dataclass(frozen=True)
class FilledTimeseries:
    values: list[float | None]
    filled: list[bool]


def fill_timeseries(
    timestamps: Sequence[float],
    values: Sequence[float | None],
    *,
    config: FillTransformation,
) -> FilledTimeseries:
    """Fill missing values using the selected mode.

    Timestamps and values correspond by index in chronological order. None represents
    a missing observation; zero is an observed value. Return new values and a boolean
    flag per bucket indicating whether a missing observation was filled, without
    mutating the input or changing bucket alignment. Unfilled gaps are not flagged.

    Supported modes:
        locf: Carry the last observed value forward. Leading missing values remain None.
        zero: Replace every missing value with zero.
        linear: Fill gaps between observations using their timestamps. Leading and
            trailing missing values remain None. Timestamps must be strictly increasing.
    """
    if len(timestamps) != len(values):
        raise ValueError("Timestamps and values must have the same length.")

    mode = config.mode
    if mode == FILL_MODE_ZERO:
        return FilledTimeseries(
            values=[0.0 if value is None else value for value in values],
            filled=[value is None for value in values],
        )

    elif mode == FILL_MODE_LINEAR:
        if any(right <= left for left, right in zip(timestamps, timestamps[1:])):
            raise ValueError("Timestamps must be strictly increasing for linear filling.")

        linear_values = list(values)
        linear_filled = [False] * len(values)
        previous_observation: tuple[int, float] | None = None
        for right_index, right_value in enumerate(values):
            if right_value is None:
                continue
            if previous_observation is not None:
                left_index, left_value = previous_observation
                duration = timestamps[right_index] - timestamps[left_index]
                for index in range(left_index + 1, right_index):
                    fraction = (timestamps[index] - timestamps[left_index]) / duration
                    linear_values[index] = left_value + (right_value - left_value) * fraction
                    linear_filled[index] = True
            previous_observation = (right_index, right_value)

        return FilledTimeseries(values=linear_values, filled=linear_filled)

    elif mode == FILL_MODE_LOCF:
        filled_values: list[float | None] = []
        filled: list[bool] = []
        last_observed_value: float | None = None
        for value in values:
            filled.append(value is None and last_observed_value is not None)
            if value is not None:
                last_observed_value = value
            filled_values.append(last_observed_value)

        return FilledTimeseries(values=filled_values, filled=filled)


def smooth_timeseries(
    timestamps: Sequence[float],
    values: Sequence[float | None],
    *,
    config: SmaSmoothTransformation | EmaSmoothTransformation,
) -> list[float | None]:
    """Smooth values using the selected mode.

    Timestamps and values correspond by index in chronological order. None represents
    a missing observation; zero is an observed value. Return a new list without
    mutating the input or changing bucket alignment, so callers can
    compose it with fill_timeseries in either order.

    Supported modes:
        sma: Simple moving average over the current bucket and the preceding
            window_size - 1 buckets. Use smaller windows at the start of the series.
            Missing buckets stay None and are excluded from the average. Each available
            value has equal weight, regardless of timestamp spacing. window_size must
            be provided and positive.
        ema: Exponential moving average. The average starts at the first observed
            value, and each later observation blends into it using this formula:
            `smoothing_factor * value + (1 - smoothing_factor) * previous_average`.
            Missing buckets stay None and don't move the average. Weights depend on
            how many observations have passed, not on the time between them.

            Unlike sma, window_size doesn't drop older values; it only sets how quickly
            their influence fades. Set smoothing_factor in (0, 1] to set it directly
            instead. smoothing_factor is only supported by ema configs.
    """
    if len(timestamps) != len(values):
        raise ValueError("Timestamps and values must have the same length.")

    if isinstance(config, EmaSmoothTransformation):
        smoothing_factor = config.smoothing_factor
        if smoothing_factor is None:
            smoothing_factor = 2 / (config.window_size + 1)

        ema_values: list[float | None] = []
        average: float | None = None
        for value in values:
            if value is None:
                ema_values.append(None)
            else:
                average = (
                    value
                    if average is None
                    else smoothing_factor * value + (1 - smoothing_factor) * average
                )
                ema_values.append(average)

        return ema_values

    smoothed_values: list[float | None] = []
    window_sum = 0.0
    window_count = 0
    for index, value in enumerate(values):
        if index >= config.window_size:
            expired_value = values[index - config.window_size]
            if expired_value is not None:
                window_sum -= expired_value
                window_count -= 1
        if value is None:
            smoothed_values.append(None)
        else:
            window_sum += value
            window_count += 1
            smoothed_values.append(window_sum / window_count)

    return smoothed_values
