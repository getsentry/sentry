from collections.abc import Sequence
from typing import Literal

import pytest
from pydantic import ValidationError

from sentry.api.helpers.timeseries_processing import (
    FILL_MODE_LINEAR,
    FILL_MODE_LOCF,
    FILL_MODE_ZERO,
    SMOOTH_MODE_EMA,
    SMOOTH_MODE_SMA,
    EmaSmoothTransformation,
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
        ("smooth(sma,1)", SmoothTransformation(mode="sma", window_size=1)),
        ("smooth(sma,3)", SmoothTransformation(mode="sma", window_size=3)),
        ("smooth(sma,5)", SmoothTransformation(mode="sma", window_size=5)),
        ("smooth( sma , 5 )", SmoothTransformation(mode="sma", window_size=5)),
        ("fill( linear )", FillTransformation(mode="linear")),
        ("fill(locf,)", FillTransformation(mode="locf")),
        ("fill(,locf)", FillTransformation(mode="locf")),
        ("fill(locf,,)", FillTransformation(mode="locf")),
        ("smooth(sma,,5)", SmoothTransformation(mode="sma", window_size=5)),
        ("smooth(sma, ,5)", SmoothTransformation(mode="sma", window_size=5)),
        ("smooth(sma,5,)", SmoothTransformation(mode="sma", window_size=5)),
        ("smooth(ema,3)", EmaSmoothTransformation(mode="ema", window_size=3)),
        ("smooth(ema,7)", EmaSmoothTransformation(mode="ema", window_size=7)),
        (
            "smooth(ema,7,0.25)",
            EmaSmoothTransformation(mode="ema", window_size=7, smoothing_factor=0.25),
        ),
        (
            "smooth( ema , 7 , 0.25 )",
            EmaSmoothTransformation(mode="ema", window_size=7, smoothing_factor=0.25),
        ),
        (
            "smooth(ema,,7,0.25,)",
            EmaSmoothTransformation(mode="ema", window_size=7, smoothing_factor=0.25),
        ),
        (
            "smooth(ema,7,1)",
            EmaSmoothTransformation(mode="ema", window_size=7, smoothing_factor=1.0),
        ),
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
        ("fill()", "argument count must be 1"),
        ("fill(,)", "argument count must be 1"),
        ("fill(locf,zero)", "argument count must be 1"),
        ("smooth()", "argument count must be 2"),
        ("smooth(, ,)", "argument count must be 2"),
        ("smooth(sma)", "argument count must be 2"),
        ("smooth(sma,)", "argument count must be 2"),
        ("smooth(,sma)", "argument count must be 2"),
        ("smooth(sma,5,6)", "argument count must be 2"),
        ("smooth(sma,0)", "Window size must be positive"),
        ("smooth(sma,-1)", "Window size must be positive"),
        ("smooth(sma,2.5)", "window_size argument invalid"),
        ("smooth(sma,true)", "window_size argument invalid"),
        ("smooth(sma,window_size=5)", "window_size argument invalid"),
        ('smooth(sma,"5")', "window_size argument invalid"),
        ("fill(sma)", "mode argument invalid"),
        ("smooth(linear,3)", "mode argument invalid"),
        ("smooth(ema)", "argument count must be 2 or 3"),
        ("smooth(ema,7,0.5,1)", "argument count must be 2 or 3"),
        ("smooth(ema,0)", "Window size must be positive"),
        ("smooth(ema,-1,0.25)", "Window size must be positive"),
        ("smooth(ema,2.5)", "window_size argument invalid"),
        ("smooth(ema,7,0)", "Smoothing factor must be greater than zero and at most one"),
        ("smooth(ema,7,-0.5)", "smoothing_factor argument invalid"),
        ("smooth(ema,7,1.1)", "smoothing_factor argument invalid"),
        ("smooth(ema,7,nan)", "smoothing_factor argument invalid"),
        ("smooth(ema,7,inf)", "smoothing_factor argument invalid"),
        ("smooth(ema,7,-inf)", "smoothing_factor argument invalid"),
        ("smooth(ema,7,true)", "smoothing_factor argument invalid"),
        ('smooth(ema,7,"0.5")', "smoothing_factor argument invalid"),
        ("smooth(ema,7,smoothing_factor=0.5)", "smoothing_factor argument invalid"),
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
    smooth = parse_transformation("smooth(sma,2)")
    assert isinstance(fill, FillTransformation)
    assert isinstance(smooth, SmoothTransformation)

    timestamps = [0.0, 1.0, 2.0]
    filled = fill_timeseries(timestamps, [1.0, None, 5.0], config=fill)
    assert filled.values == [1.0, 3.0, 5.0]
    assert smooth_timeseries(timestamps, filled.values, config=smooth) == [1.0, 2.0, 4.0]


@pytest.mark.parametrize(
    "transformation, expected",
    [
        ("smooth(ema,7)", [2.0, 2.5, 3.375, 4.53125]),
        ("smooth(ema,7,0.5)", [2.0, 3.0, 4.5, 6.25]),
    ],
)
def test_parsed_ema_with_processing_helper(transformation: str, expected: list[float]) -> None:
    config = parse_transformation(transformation)
    assert isinstance(config, EmaSmoothTransformation)

    assert smooth_timeseries([0.0, 1.0, 2.0, 3.0], [2.0, 4.0, 6.0, 8.0], config=config) == expected


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

    result = fill_timeseries(timestamps, values, config=FillTransformation(mode=FILL_MODE_LOCF))

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

    result = fill_timeseries(timestamps, values, config=FillTransformation(mode=FILL_MODE_ZERO))

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

    result = fill_timeseries(timestamps, values, config=FillTransformation(mode=FILL_MODE_LINEAR))

    assert result.values == expected
    assert result.filled == filled
    assert result.values is not values
    assert tuple(values) == original_values
    assert tuple(timestamps) == original_timestamps


@pytest.mark.parametrize("timestamps", [[0.0, 0.0, 1.0], [0.0, 2.0, 1.0]])
def test_fill_timeseries_linear_rejects_nonincreasing_timestamps(timestamps: list[float]) -> None:
    with pytest.raises(ValueError, match="Timestamps must be strictly increasing"):
        fill_timeseries(
            timestamps, [0.0, None, 1.0], config=FillTransformation(mode=FILL_MODE_LINEAR)
        )


@pytest.mark.parametrize("mode", [FILL_MODE_LOCF, FILL_MODE_ZERO, FILL_MODE_LINEAR])
@pytest.mark.parametrize("timestamps, values", [([0.0], []), ([], [1.0])])
def test_fill_timeseries_rejects_mismatched_lengths(
    timestamps: list[float], values: list[float | None], mode: Literal["locf", "zero", "linear"]
) -> None:
    with pytest.raises(ValueError, match="Timestamps and values must have the same length"):
        fill_timeseries(timestamps, values, config=FillTransformation(mode=mode))


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

    result = smooth_timeseries(
        timestamps,
        values,
        config=SmoothTransformation(mode=SMOOTH_MODE_SMA, window_size=window_size),
    )

    assert result == expected
    assert result is not values
    assert tuple(values) == original_values
    assert tuple(timestamps) == original_timestamps


def test_smooth_timeseries_sma_equal_weighting() -> None:
    result = smooth_timeseries(
        [0.0, 1.0, 10.0, 20.0],
        [2.0, 4.0, 6.0, 8.0],
        config=SmoothTransformation(mode=SMOOTH_MODE_SMA, window_size=3),
    )

    assert result == [2.0, 3.0, 4.0, 6.0]


@pytest.mark.parametrize(
    "config",
    [
        SmoothTransformation(mode="sma", window_size=3),
        EmaSmoothTransformation(mode="ema", window_size=3),
    ],
)
@pytest.mark.parametrize("timestamps, values", [([0.0], []), ([], [1.0])])
def test_smooth_timeseries_rejects_mismatched_lengths(
    timestamps: list[float],
    values: list[float | None],
    config: SmoothTransformation | EmaSmoothTransformation,
) -> None:
    with pytest.raises(ValueError, match="Timestamps and values must have the same length"):
        smooth_timeseries(timestamps, values, config=config)


@pytest.mark.parametrize(
    "model, config, field, error_type",
    [
        (FillTransformation, {}, "mode", "value_error.missing"),
        (FillTransformation, {"mode": "quadratic"}, "mode", "value_error.const"),
        (FillTransformation, {"mode": ""}, "mode", "value_error.const"),
        (
            FillTransformation,
            {"mode": "zero", "window_size": 3},
            "window_size",
            "value_error.extra",
        ),
        (SmoothTransformation, {}, "mode", "value_error.missing"),
        (SmoothTransformation, {"mode": "sma"}, "window_size", "value_error.missing"),
        (SmoothTransformation, {"mode": "ema"}, "mode", "value_error.const"),
        (SmoothTransformation, {"mode": ""}, "mode", "value_error.const"),
        (SmoothTransformation, {"mode": "sma", "window_size": 0}, "window_size", "value_error"),
        (SmoothTransformation, {"mode": "sma", "window_size": -1}, "window_size", "value_error"),
        (SmoothTransformation, {"mode": "sma", "window_size": True}, "window_size", "value_error"),
        (SmoothTransformation, {"mode": "sma", "window_size": "3"}, "window_size", "value_error"),
        (SmoothTransformation, {"mode": "sma", "window_size": 3.0}, "window_size", "value_error"),
        (SmoothTransformation, {"mode": "sma", "window_size": None}, "window_size", "value_error"),
        (
            SmoothTransformation,
            {"mode": "sma", "window_size": 3, "smoothing_factor": 0.5},
            "smoothing_factor",
            "value_error.extra",
        ),
    ],
)
def test_transformation_config_rejects_invalid_values(
    model: type[FillTransformation] | type[SmoothTransformation] | type[EmaSmoothTransformation],
    config: dict[str, object],
    field: str,
    error_type: str,
) -> None:
    with pytest.raises(ValidationError) as error:
        model.parse_obj(config)

    assert error.value.errors()[0]["loc"] == (field,)
    assert error.value.errors()[0]["type"] == error_type


def test_transformation_config_is_immutable() -> None:
    config = SmoothTransformation(mode="sma", window_size=2)

    with pytest.raises(TypeError, match="immutable"):
        setattr(config, "window_size", 1)

    assert smooth_timeseries([0.0, 1.0, 2.0], [1.0, 3.0, 5.0], config=config) == [1.0, 2.0, 4.0]


@pytest.mark.parametrize("window_size", [0, -1, True, "3", 3.0, None])
def test_ema_config_rejects_invalid_window(window_size: object) -> None:
    with pytest.raises(ValidationError) as error:
        EmaSmoothTransformation.parse_obj({"mode": "ema", "window_size": window_size})

    assert error.value.errors()[0]["loc"] == ("window_size",)


@pytest.mark.parametrize(
    "factor",
    [0.0, -0.5, 1.1, float("nan"), float("inf"), -float("inf"), True, False, "0.5", []],
)
def test_ema_config_rejects_invalid_factor(factor: object) -> None:
    with pytest.raises(ValidationError) as error:
        EmaSmoothTransformation.parse_obj(
            {"mode": "ema", "window_size": 3, "smoothing_factor": factor}
        )

    assert error.value.errors()[0]["loc"] == ("smoothing_factor",)


def test_ema_config_is_immutable() -> None:
    config = EmaSmoothTransformation(mode="ema", window_size=7, smoothing_factor=0.25)

    with pytest.raises(TypeError, match="immutable"):
        setattr(config, "smoothing_factor", 0.5)

    assert smooth_timeseries([0.0, 1.0], [2.0, 6.0], config=config) == [2.0, 3.0]


@pytest.mark.parametrize(
    "values, smoothing_factor, expected",
    [
        pytest.param([], 0.5, [], id="empty"),
        pytest.param([None, None], 0.5, [None, None], id="all-missing"),
        pytest.param(
            [10.0, 20.0, 30.0, 40.0], 0.5, [10.0, 15.0, 22.5, 31.25], id="exponential-average"
        ),
        pytest.param(
            [0.0, 8.0, 0.0, 0.0, 0.0], 0.5, [0.0, 4.0, 2.0, 1.0, 0.5], id="older-observation-decays"
        ),
        pytest.param((10.0, 20.0, 30.0), 0.25, [10.0, 12.5, 16.875], id="smaller-factor"),
        pytest.param([1.0, None, 3.0], 1.0, [1.0, None, 3.0], id="factor-one"),
        pytest.param([0.0, -4.0, 4.0], 0.5, [0.0, -2.0, 1.0], id="zero-and-negative"),
        pytest.param([8.0, 8.0, 8.0], 0.5, [8.0, 8.0, 8.0], id="constant-series"),
        pytest.param(
            [None, 2.0, None, 8.0, 10.0, None],
            0.5,
            [None, 2.0, None, 5.0, 7.5, None],
            id="gaps-preserved",
        ),
        pytest.param(
            [2.0, None, None, None, 8.0],
            0.5,
            [2.0, None, None, None, 5.0],
            id="state-preserved-across-long-gap",
        ),
    ],
)
def test_smooth_timeseries_ema(
    values: Sequence[float | None], smoothing_factor: float, expected: list[float | None]
) -> None:
    timestamps = [float(index) for index in range(len(values))]
    original_values = tuple(values)
    original_timestamps = tuple(timestamps)

    result = smooth_timeseries(
        timestamps,
        values,
        config=EmaSmoothTransformation(
            mode=SMOOTH_MODE_EMA, window_size=3, smoothing_factor=smoothing_factor
        ),
    )

    assert result == expected
    assert result is not values
    assert tuple(values) == original_values
    assert tuple(timestamps) == original_timestamps


def test_smooth_timeseries_ema_default_factor_and_irregular_timestamps() -> None:
    result = smooth_timeseries(
        [0.0, 1.0, 10.0, 20.0],
        [2.0, 4.0, 6.0, 8.0],
        config=EmaSmoothTransformation(mode=SMOOTH_MODE_EMA, window_size=3),
    )

    assert result == [2.0, 3.0, 4.5, 6.25]


@pytest.mark.parametrize(
    "values, window_size, expected",
    [
        pytest.param([], 7, [], id="empty"),
        pytest.param([2.0, 4.0, 6.0, 8.0], 1, [2.0, 4.0, 6.0, 8.0], id="window-one"),
        pytest.param([2.0, 4.0, 6.0, 8.0], 3, [2.0, 3.0, 4.5, 6.25], id="window-three"),
        pytest.param(
            [2.0, 4.0, 6.0, 8.0], 7, [2.0, 2.5, 3.375, 4.53125], id="window-larger-than-series"
        ),
        pytest.param(
            [None, 2.0, None, 8.0, 10.0, None],
            7,
            [None, 2.0, None, 3.5, 5.125, None],
            id="gaps-preserved",
        ),
    ],
)
def test_smooth_timeseries_ema_window(
    values: Sequence[float | None], window_size: int, expected: list[float | None]
) -> None:
    timestamps = [float(index) for index in range(len(values))]

    result = smooth_timeseries(
        timestamps,
        values,
        config=EmaSmoothTransformation(mode=SMOOTH_MODE_EMA, window_size=window_size),
    )

    assert result == expected


def test_smooth_timeseries_ema_explicit_factor_overrides_window() -> None:
    result = smooth_timeseries(
        [0.0, 1.0, 2.0, 3.0],
        [2.0, 4.0, 6.0, 8.0],
        config=EmaSmoothTransformation(mode=SMOOTH_MODE_EMA, window_size=7, smoothing_factor=0.5),
    )

    assert result == [2.0, 3.0, 4.5, 6.25]


def test_smooth_timeseries_ema_composes_with_filling_in_either_order() -> None:
    timestamps = [0.0, 1.0, 2.0]
    values = [2.0, None, 8.0]

    filled = fill_timeseries(timestamps, values, config=FillTransformation(mode=FILL_MODE_ZERO))
    fill_then_smooth = smooth_timeseries(
        timestamps,
        filled.values,
        config=EmaSmoothTransformation(mode=SMOOTH_MODE_EMA, window_size=3),
    )
    smoothed = smooth_timeseries(
        timestamps, values, config=EmaSmoothTransformation(mode=SMOOTH_MODE_EMA, window_size=3)
    )
    smooth_then_fill = fill_timeseries(
        timestamps, smoothed, config=FillTransformation(mode=FILL_MODE_ZERO)
    )

    assert fill_then_smooth == [2.0, 1.0, 4.5]
    assert smooth_then_fill.values == [2.0, 0.0, 5.0]
    assert filled.filled == smooth_then_fill.filled == [False, True, False]
