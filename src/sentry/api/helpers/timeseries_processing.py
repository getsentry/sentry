from collections.abc import Sequence
from dataclasses import dataclass
from itertools import groupby
from math import fsum, isfinite
from typing import Final, Literal, overload

FILL_MODE_LOCF: Final = "locf"
FILL_MODE_ZERO: Final = "zero"
FILL_MODE_LINEAR: Final = "linear"

SMOOTH_MODE_SMA: Final = "sma"
SMOOTH_MODE_EMA: Final = "ema"
SMOOTH_MODE_ASAP: Final = "asap"


@dataclass(frozen=True)
class FilledTimeseries:
    values: list[float | None]
    filled: list[bool]


def fill_timeseries(
    timestamps: Sequence[float],
    values: Sequence[float | None],
    *,
    mode: Literal["locf", "zero", "linear"],
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
    else:
        raise ValueError(f"Unsupported fill mode: {mode}")


@overload
def smooth_timeseries(
    timestamps: Sequence[float],
    values: Sequence[float | None],
    *,
    mode: Literal["asap"],
) -> list[float | None]: ...


@overload
def smooth_timeseries(
    timestamps: Sequence[float],
    values: Sequence[float | None],
    *,
    mode: Literal["sma"],
    window_size: int = 3,
) -> list[float | None]: ...


@overload
def smooth_timeseries(
    timestamps: Sequence[float],
    values: Sequence[float | None],
    *,
    mode: Literal["ema"],
    window_size: int = 3,
    smoothing_factor: float | None = None,
) -> list[float | None]: ...


def smooth_timeseries(
    timestamps: Sequence[float],
    values: Sequence[float | None],
    *,
    mode: Literal["sma", "ema", "asap"],
    window_size: int = 3,
    smoothing_factor: float | None = None,
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
        ema: Exponential moving average seeded with the first observed value. Each
            later observation updates the average as smoothing_factor * value +
            (1 - smoothing_factor) * previous_average. Missing buckets stay None and
            leave the average unchanged. Weighting depends on observations, regardless
            of timestamp spacing. window_size is a positive span that determines the
            factor as 2 / (window_size + 1), without cutting off older observations.
            An explicit smoothing_factor in (0, 1] overrides the span-derived factor.
            The default span of three gives a factor of 0.5. smoothing_factor applies
            only to ema.
        asap: Automatically select a moving-average window for each contiguous run
            of observations. Minimize the variance of adjacent differences without
            decreasing Pearson kurtosis, scoring complete windows as in Stanford's
            ASAP-simple reference. Search windows from round(run_length / 10) down
            to two, retaining the original values when none improves the objective.
            Return partial windows at the start to preserve bucket alignment; these
            startup values do not participate in the selection metrics. Missing
            buckets stay None and separate independent runs. Observations must be
            finite. window_size and smoothing_factor do not apply to asap.
    """
    if len(timestamps) != len(values):
        raise ValueError("Timestamps and values must have the same length.")

    if mode == SMOOTH_MODE_SMA:
        if window_size < 1:
            raise ValueError("Window size must be positive.")

        smoothed_values: list[float | None] = []
        window_sum = 0.0
        window_count = 0
        for index, value in enumerate(values):
            if index >= window_size:
                expired_value = values[index - window_size]
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
    elif mode == SMOOTH_MODE_EMA:
        if window_size < 1:
            raise ValueError("Window size must be positive.")
        if smoothing_factor is None:
            smoothing_factor = 2 / (window_size + 1)
        if not 0 < smoothing_factor <= 1:
            raise ValueError("Smoothing factor must be greater than zero and at most one.")

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
    elif mode == SMOOTH_MODE_ASAP:
        if any(value is not None and not isfinite(value) for value in values):
            raise ValueError("ASAP observations must be finite.")

        asap_values: list[float | None] = []
        for observed, group in groupby(values, key=lambda value: value is not None):
            if observed:
                asap_values.extend(_smooth_asap([value for value in group if value is not None]))
            else:
                asap_values.extend(group)
        return asap_values
    else:
        raise ValueError(f"Unsupported smoothing mode: {mode}")


def _smooth_asap(values: Sequence[float]) -> list[float]:
    """Smooth one observed run using Stanford's ASAP simple window search.

    Reference implementation and its Apache-2.0 license at the revision used:
        https://github.com/stanford-futuredata/ASAP/blob/bdd467b53c2af05fb5d67b28a79ed40584ee4355/ASAP-simple.js
        https://github.com/stanford-futuredata/ASAP/blob/bdd467b53c2af05fb5d67b28a79ed40584ee4355/LICENSE
    Paper:
        https://arxiv.org/abs/1703.00983

    Score complete windows. Retain partial startup averages to preserve bucket
    alignment, excluding them from selection metrics. The caller handles missing
    buckets by smoothing each observed run independently.
    """
    max_window = (len(values) + 5) // 10
    if max_window < 2 or min(values) == max(values):
        return list(values)

    scale = max(abs(value) for value in values)
    normalized = [value / scale for value in values]
    min_roughness, original_kurtosis = _asap_metrics(normalized)
    best_values = list(values)
    for window_size in range(max_window, 1, -1):
        smoothed = _asap_moving_average(normalized, window_size)
        roughness, kurtosis = _asap_metrics(smoothed[window_size - 1 :])
        if roughness < min_roughness and kurtosis >= original_kurtosis:
            min_roughness = roughness
            best_values = [value * scale for value in smoothed]

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
    mean = fsum(values) / len(values)
    deviations = [value - mean for value in values]
    deviation_scale = max(abs(value) for value in deviations)
    kurtosis = 0.0
    if deviation_scale:
        centered = [value / deviation_scale for value in deviations]
        second_moment = fsum(value**2 for value in centered)
        kurtosis = len(values) * fsum(value**4 for value in centered) / second_moment**2

    differences = [right - left for left, right in zip(values, values[1:])]
    mean_difference = fsum(differences) / len(differences)
    roughness = fsum((value - mean_difference) ** 2 for value in differences) / len(differences)
    return roughness, kurtosis
