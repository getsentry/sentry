from collections.abc import Sequence
from typing import Any, Literal

import pytest

from sentry.api.helpers.timeseries_processing import (
    FILL_MODE_LINEAR,
    FILL_MODE_LOCF,
    FILL_MODE_ZERO,
    SMOOTH_MODE_SMA,
    FillTransformation,
    SmoothTransformation,
    Transformation,
    fill_timeseries,
    parse_transformation,
    smooth_timeseries,
)
from sentry.exceptions import InvalidSearchQuery


@pytest.mark.parametrize(
    "value, expected",
    [
        ("fill(locf)", FillTransformation(mode="locf")),
        ("fill(zero)", FillTransformation(mode="zero")),
        ("fill(linear)", FillTransformation(mode="linear")),
        ("smooth(sma)", SmoothTransformation(mode="sma")),
        ("fill( linear )", FillTransformation(mode="linear")),
    ],
)
def test_parse_transformation(value: str, expected: Transformation) -> None:
    assert parse_transformation(value) == expected


@pytest.mark.parametrize(
    "value, message",
    [
        ("", "is not a valid transformation"),
        ("fill", "is not a valid transformation"),
        ("fill(locf", "is not a valid transformation"),
        ("fill(locf)extra", "is not a valid transformation"),
        ("fill(locf)\n", "is not a valid transformation"),
        ("[fill(locf), smooth(sma)]", "is not a valid transformation"),
        ("fill(locf) AS filled", "is not a valid transformation"),
        ("count(locf)", "is not a valid transformation function"),
        ("FILL(locf)", "is not a valid transformation function"),
        ("fill()", "expected a single mode argument"),
        ("smooth(sma,3)", "expected a single mode argument"),
        ("fill(locf,zero)", "expected a single mode argument"),
        ("fill(locf,)", "expected a single mode argument"),
        ("fill(,locf)", "expected a single mode argument"),
        ("fill(locf,,)", "expected a single mode argument"),
        ("fill(sma)", "mode argument invalid"),
        ("smooth(linear)", "mode argument invalid"),
        ("smooth(ema)", "mode argument invalid"),
        ("fill(LOCF)", "mode argument invalid"),
        ('fill("locf")', "mode argument invalid"),
        ("fill(mode=locf)", "mode argument invalid"),
        ("fill(smooth(sma))", "mode argument invalid"),
        ("fill(locf))", "mode argument invalid"),
    ],
)
def test_parse_transformation_invalid(value: str, message: str) -> None:
    with pytest.raises(InvalidSearchQuery, match=message):
        parse_transformation(value)


def test_parsed_transformations_with_processing_helpers() -> None:
    fill = parse_transformation("fill(linear)")
    smooth = parse_transformation("smooth(sma)")
    assert isinstance(fill, FillTransformation)
    assert isinstance(smooth, SmoothTransformation)

    timestamps = [0.0, 1.0, 2.0]
    filled = fill_timeseries(timestamps, [1.0, None, 5.0], mode=fill.mode)
    assert filled.values == [1.0, 3.0, 5.0]
    assert smooth_timeseries(timestamps, filled.values, mode=smooth.mode) == [1.0, 2.0, 3.0]


@pytest.mark.parametrize(
    "values, expected, filled",
    [
        pytest.param([], [], [], id="empty"),
        pytest.param([None, None], [None, None], [False, False], id="all-missing"),
        pytest.param(
            [None, None, 10.0, None],
            [None, None, 10.0, 10.0],
            [False, False, False, True],
            id="leading-gap",
        ),
        pytest.param(
            [10.0, None, None, 40.0, None],
            [10.0, 10.0, 10.0, 40.0, 40.0],
            [False, True, True, False, True],
            id="interior-and-trailing-gaps",
        ),
        pytest.param(
            [10.0, 0.0, None, -5.0, None],
            [10.0, 0.0, 0.0, -5.0, -5.0],
            [False, False, True, False, True],
            id="zero",
        ),
        pytest.param((1.0, 2.0, 3.0), [1.0, 2.0, 3.0], [False, False, False], id="observed-tuple"),
        pytest.param(
            [10.0, 10.0, None], [10.0, 10.0, 10.0], [False, False, True], id="repeated-observations"
        ),
    ],
)
def test_fill_timeseries_locf(
    values: Sequence[float | None], expected: list[float | None], filled: list[bool]
) -> None:
    timestamps = [float(index) for index in range(len(values))]
    original_values = tuple(values)

    result = fill_timeseries(timestamps, values, mode=FILL_MODE_LOCF)

    assert result.values == expected
    assert result.filled == filled
    assert result.values is not values
    assert tuple(values) == original_values


@pytest.mark.parametrize(
    "values, expected, filled",
    [
        pytest.param([], [], [], id="empty"),
        pytest.param([None, None], [0.0, 0.0], [True, True], id="all-missing"),
        pytest.param(
            (None, -4.0, 0.0, None, 5.0, None),
            [0.0, -4.0, 0.0, 0.0, 5.0, 0.0],
            [True, False, False, True, False, True],
            id="gaps-and-observed-zero",
        ),
    ],
)
def test_fill_timeseries_zero(
    values: Sequence[float | None], expected: list[float | None], filled: list[bool]
) -> None:
    timestamps = [float(index) for index in range(len(values))]
    original_values = tuple(values)

    result = fill_timeseries(timestamps, values, mode=FILL_MODE_ZERO)

    assert result.values == expected
    assert result.filled == filled
    assert result.values is not values
    assert tuple(values) == original_values


@pytest.mark.parametrize(
    "timestamps, values, expected, filled",
    [
        pytest.param([], [], [], [], id="empty"),
        pytest.param([0.0, 1.0], [None, None], [None, None], [False, False], id="all-missing"),
        pytest.param(
            [0.0, 1.0, 2.0],
            [None, 2.0, None],
            [None, 2.0, None],
            [False, False, False],
            id="single-observation",
        ),
        pytest.param(
            [0.0, 1.0, 2.0, 3.0, 4.0, 5.0],
            [None, 10.0, None, None, 40.0, None],
            [None, 10.0, 20.0, 30.0, 40.0, None],
            [False, False, True, True, False, False],
            id="interior-and-boundary-gaps",
        ),
        pytest.param(
            [0.0, 1.0, 3.0, 4.0, 8.0],
            (0.0, None, 6.0, None, -4.0),
            [0.0, 2.0, 6.0, 4.0, -4.0],
            [False, True, False, True, False],
            id="irregular-timestamps-and-observed-zero",
        ),
        pytest.param(
            [0.0, 1.0, 2.0],
            [0.0, None, 0.0],
            [0.0, 0.0, 0.0],
            [False, True, False],
            id="fill-zero-between-zeros",
        ),
    ],
)
def test_fill_timeseries_linear(
    timestamps: Sequence[float],
    values: Sequence[float | None],
    expected: list[float | None],
    filled: list[bool],
) -> None:
    original_values = tuple(values)
    original_timestamps = tuple(timestamps)

    result = fill_timeseries(timestamps, values, mode=FILL_MODE_LINEAR)

    assert result.values == expected
    assert result.filled == filled
    assert result.values is not values
    assert tuple(values) == original_values
    assert tuple(timestamps) == original_timestamps


@pytest.mark.parametrize("timestamps", [[0.0, 0.0, 1.0], [0.0, 2.0, 1.0]])
def test_fill_timeseries_linear_rejects_nonincreasing_timestamps(timestamps: list[float]) -> None:
    with pytest.raises(ValueError, match="Timestamps must be strictly increasing"):
        fill_timeseries(timestamps, [0.0, None, 1.0], mode=FILL_MODE_LINEAR)


@pytest.mark.parametrize("mode", [FILL_MODE_LOCF, FILL_MODE_ZERO, FILL_MODE_LINEAR])
@pytest.mark.parametrize("timestamps, values", [([0.0], []), ([], [1.0])])
def test_fill_timeseries_rejects_mismatched_lengths(
    timestamps: list[float], values: list[float | None], mode: Literal["locf", "zero", "linear"]
) -> None:
    with pytest.raises(ValueError, match="Timestamps and values must have the same length"):
        fill_timeseries(timestamps, values, mode=mode)


@pytest.mark.parametrize("mode", ["quadratic", ""])
def test_fill_timeseries_rejects_unsupported_modes(mode: Any) -> None:
    with pytest.raises(ValueError, match="Unsupported fill mode"):
        fill_timeseries([0.0, 1.0], [10.0, None], mode=mode)


@pytest.mark.parametrize(
    "values, window_size, expected",
    [
        pytest.param([], 3, [], id="empty"),
        pytest.param([None, None], 3, [None, None], id="all-missing"),
        pytest.param([1.0, 2.0, 3.0, 4.0, 5.0], 3, [1.0, 1.5, 2.0, 3.0, 4.0], id="trailing-window"),
        pytest.param((1.0, 2.0, 3.0), 5, [1.0, 1.5, 2.0], id="window-larger-than-series"),
        pytest.param([1.0, None, 3.0], 1, [1.0, None, 3.0], id="window-one"),
        pytest.param([-2.0, 0.0, 2.0, 4.0], 2, [-2.0, -1.0, 1.0, 3.0], id="zero-and-negative"),
        pytest.param(
            [None, 2.0, None, 8.0, 10.0, None],
            3,
            [None, 2.0, None, 5.0, 9.0, None],
            id="gaps-preserved",
        ),
        pytest.param(
            [2.0, None, None, None, 8.0],
            3,
            [2.0, None, None, None, 8.0],
            id="empty-window-after-long-gap",
        ),
    ],
)
def test_smooth_timeseries_sma(
    values: Sequence[float | None], window_size: int, expected: list[float | None]
) -> None:
    timestamps = [float(index) for index in range(len(values))]
    original_values = tuple(values)
    original_timestamps = tuple(timestamps)

    result = smooth_timeseries(timestamps, values, mode=SMOOTH_MODE_SMA, window_size=window_size)

    assert result == expected
    assert result is not values
    assert tuple(values) == original_values
    assert tuple(timestamps) == original_timestamps


def test_smooth_timeseries_sma_default_window_and_equal_weighting() -> None:
    result = smooth_timeseries([0.0, 1.0, 10.0, 20.0], [2.0, 4.0, 6.0, 8.0], mode=SMOOTH_MODE_SMA)

    assert result == [2.0, 3.0, 4.0, 6.0]


@pytest.mark.parametrize("window_size", [0, -1])
def test_smooth_timeseries_rejects_nonpositive_window(window_size: int) -> None:
    with pytest.raises(ValueError, match="Window size must be positive"):
        smooth_timeseries([0.0], [1.0], mode=SMOOTH_MODE_SMA, window_size=window_size)


@pytest.mark.parametrize("timestamps, values", [([0.0], []), ([], [1.0])])
def test_smooth_timeseries_rejects_mismatched_lengths(
    timestamps: list[float], values: list[float | None]
) -> None:
    with pytest.raises(ValueError, match="Timestamps and values must have the same length"):
        smooth_timeseries(timestamps, values, mode=SMOOTH_MODE_SMA)


@pytest.mark.parametrize("mode", ["ema", ""])
def test_smooth_timeseries_rejects_unsupported_modes(mode: Any) -> None:
    with pytest.raises(ValueError, match="Unsupported smoothing mode"):
        smooth_timeseries([0.0], [1.0], mode=mode)
