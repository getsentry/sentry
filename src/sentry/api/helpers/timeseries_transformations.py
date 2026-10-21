import re
from collections.abc import Sequence
from dataclasses import dataclass
from itertools import groupby, pairwise
from math import fsum, isfinite
from statistics import fmean, pvariance
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
SMOOTH_MODE_ASAP: Final = "asap"


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


class AsapSmoothTransformation(BaseModel):
    mode: Literal["asap"]
    max_window_size: int | None = None

    class Config:
        extra = "forbid"
        frozen = True
        validate_all = True

    @validator("max_window_size", pre=True)
    def validate_max_window_size(cls, value: object) -> int | None:
        if value is None:
            return None
        if not isinstance(value, int) or isinstance(value, bool):
            raise ValueError("Maximum window size must be an integer.")
        if value < 1:
            raise ValueError("Maximum window size must be positive.")
        return value


Transformation = (
    FillTransformation
    | SmaSmoothTransformation
    | EmaSmoothTransformation
    | AsapSmoothTransformation
)

_TRANSFORMATIONS: dict[
    str,
    tuple[
        type[FillTransformation]
        | type[SmaSmoothTransformation]
        | type[EmaSmoothTransformation]
        | type[AsapSmoothTransformation],
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
        if arguments and arguments[0] == SMOOTH_MODE_ASAP:
            if len(arguments) not in (1, 2):
                raise InvalidSearchQuery(f"{value}: argument count must be 1 or 2")
            model = AsapSmoothTransformation
            argument_definitions = (
                FunctionArg("mode"),
                IntArg("max_window_size", negative=True),
            )
        elif arguments and arguments[0] == SMOOTH_MODE_EMA:
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
                permitted = (SMOOTH_MODE_SMA, SMOOTH_MODE_EMA, SMOOTH_MODE_ASAP)
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
        if len(values) > len(_TRANSFORMATIONS):
            raise ParseError(
                detail=f"At most {len(_TRANSFORMATIONS)} transformations are allowed per yAxis"
            )
        with handle_query_errors():
            transformations[index] = [parse_transformation(value) for value in values]
        functions = [
            "fill" if isinstance(transformation, FillTransformation) else "smooth"
            for transformation in transformations[index]
        ]
        if len(functions) != len(set(functions)):
            raise ParseError(
                detail="Only one transformation per function type is allowed per yAxis"
            )
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
    config: SmaSmoothTransformation | EmaSmoothTransformation | AsapSmoothTransformation,
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
        asap: Automatically select a moving-average window for each contiguous run
            of observations. Minimize the variance of adjacent differences without
            decreasing Pearson kurtosis, scoring complete windows as in Stanford's
            Python smooth_simple reference. Search windows from two through
            max_window_size, defaulting to run_length // 5. An explicit limit must
            be positive and is capped at run_length - 1 to leave at least two
            complete windows for scoring. Prefer smaller windows when roughness
            ties. Retain the original values when no window improves the objective.
            Return partial windows at the start to preserve bucket alignment. The
            kurtosis constraint applies only to complete windows, excluding startup
            averages. Missing buckets stay None and separate independent runs. Only
            non-None values must be finite. window_size and smoothing_factor do not
            apply to asap. max_window_size applies only to asap.
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

    if isinstance(config, AsapSmoothTransformation):
        if any(value is not None and not isfinite(value) for value in values):
            raise ValueError("ASAP observations must be finite.")

        asap_values: list[float | None] = []
        for observed, group in groupby(values, key=lambda value: value is not None):
            if observed:
                asap_values.extend(
                    _smooth_asap(
                        [value for value in group if value is not None],
                        max_window_size=config.max_window_size,
                    )
                )
            else:
                asap_values.extend(group)
        return asap_values

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


def _smooth_asap(values: Sequence[float], *, max_window_size: int | None = None) -> list[float]:
    """Smooth one observed run using Stanford's Python smooth_simple window search.

    Reference implementation and its Apache-2.0 license at the revision used:
        https://github.com/stanford-futuredata/ASAP/blob/8b39db4bc92590cbe5b44ddace9b7bb1d677248b/ASAP.ipynb
        https://github.com/stanford-futuredata/ASAP/blob/8b39db4bc92590cbe5b44ddace9b7bb1d677248b/LICENSE
    Paper:
        https://arxiv.org/abs/1703.00983
    """
    max_window = (
        len(values) // 5 if max_window_size is None else min(max_window_size, len(values) - 1)
    )
    if max_window < 2 or min(values) == max(values):
        return list(values)

    scale = max(abs(value) for value in values)
    normalized = [value / scale for value in values]
    min_roughness, original_kurtosis = _asap_metrics(normalized)
    best_window = 1
    for window_size in range(2, max_window + 1):
        smoothed = _asap_moving_average(normalized, window_size)
        roughness, kurtosis = _asap_metrics(smoothed[window_size - 1 :])
        if roughness < min_roughness and kurtosis >= original_kurtosis:
            min_roughness = roughness
            best_window = window_size

    if best_window == 1:
        return list(values)

    best_values = [value * scale for value in _asap_moving_average(normalized, best_window)]

    return best_values if all(isfinite(value) for value in best_values) else list(values)


def _asap_moving_average(values: Sequence[float], window_size: int) -> list[float]:
    smoothed: list[float] = []
    window_sum = 0.0
    for index, value in enumerate(values):
        expired = values[index - window_size] if index >= window_size else 0.0
        window_sum = fsum((window_sum, value, -expired))
        smoothed.append(window_sum / min(index + 1, window_size))
    return smoothed


def _asap_metrics(values: Sequence[float]) -> tuple[float, float]:
    mean = fmean(values)
    deviations = [value - mean for value in values]
    deviation_scale = max(abs(value) for value in deviations)
    kurtosis = 0.0
    if deviation_scale:
        centered = [value / deviation_scale for value in deviations]
        second_moment = fsum(value**2 for value in centered)
        kurtosis = len(values) * fsum(value**4 for value in centered) / second_moment**2

    roughness = pvariance(right - left for left, right in pairwise(values))
    return roughness, kurtosis
