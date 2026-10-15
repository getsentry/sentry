from collections.abc import Sequence
from dataclasses import dataclass
from typing import Final, Literal

from pydantic import BaseModel, ValidationError, validator

from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.constants import FUNCTION_PATTERN
from sentry.search.events.fields import (
    FunctionArg,
    IntArg,
    InvalidFunctionArgument,
    parse_arguments,
)

FILL_MODE_LOCF: Final = "locf"
FILL_MODE_ZERO: Final = "zero"
FILL_MODE_LINEAR: Final = "linear"

SMOOTH_MODE_SMA: Final = "sma"

FillMode = Literal["locf", "zero", "linear"]
SmoothMode = Literal["sma"]


class FillTransformation(BaseModel):
    mode: FillMode

    class Config:
        extra = "forbid"
        frozen = True
        validate_all = True


class SmoothTransformation(BaseModel):
    mode: SmoothMode
    window_size: int = 3

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


Transformation = FillTransformation | SmoothTransformation

_TRANSFORMATIONS: dict[
    str,
    tuple[type[FillTransformation] | type[SmoothTransformation], tuple[FunctionArg, ...]],
] = {
    "fill": (FillTransformation, (FunctionArg("mode"),)),
    "smooth": (
        SmoothTransformation,
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
    columns = match.group("columns")
    arguments = parse_arguments(function, columns)
    if len(arguments) != columns.count(",") + 1:
        raise InvalidSearchQuery(f"{value}: empty transformation arguments are not allowed")

    required_count = sum(
        model.__fields__[argument.name].required is True for argument in argument_definitions
    )
    if not required_count <= len(arguments) <= len(argument_definitions):
        expected = str(required_count)
        if required_count != len(argument_definitions):
            expected = f"{required_count} to {len(argument_definitions)}"
        raise InvalidSearchQuery(f"{value}: argument count must be {expected}")

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
            message = f"expected one of {', '.join(detail['ctx']['permitted'])}"
        raise InvalidSearchQuery(f"{value}: {detail['loc'][0]} argument invalid: {message}")


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
    config: SmoothTransformation,
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
            be positive and defaults to three buckets.
    """
    if len(timestamps) != len(values):
        raise ValueError("Timestamps and values must have the same length.")

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
