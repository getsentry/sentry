from collections.abc import Sequence
from dataclasses import dataclass
from typing import Final, Literal

FILL_MODE_LOCF: Final = "locf"
FILL_MODE_ZERO: Final = "zero"
FILL_MODE_LINEAR: Final = "linear"

SMOOTH_MODE_SMA: Final = "sma"


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


def smooth_timeseries(
    timestamps: Sequence[float],
    values: Sequence[float | None],
    *,
    mode: Literal["sma"],
    window_size: int = 3,
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
    else:
        raise ValueError(f"Unsupported smoothing mode: {mode}")
