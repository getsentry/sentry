import sys
from collections.abc import Sequence
from typing import Literal

import pytest
from pydantic import ValidationError

from sentry.api.helpers.timeseries_transformations import (
    FILL_MODE_LINEAR,
    FILL_MODE_LOCF,
    FILL_MODE_ZERO,
    SMOOTH_MODE_ASAP,
    SMOOTH_MODE_EMA,
    SMOOTH_MODE_SMA,
    AsapSmoothTransformation,
    EmaSmoothTransformation,
    FillTransformation,
    SmaSmoothTransformation,
    Transformation,
    fill_timeseries,
    parse_transformation,
    parse_transformations,
    smooth_timeseries,
)
from sentry.exceptions import InvalidSearchQuery


@pytest.mark.parametrize(
    "value, expected",
    [
        ("fill(locf)", FillTransformation(mode="locf")),
        ("fill(zero)", FillTransformation(mode="zero")),
        ("fill(linear)", FillTransformation(mode="linear")),
        ("smooth(sma,1)", SmaSmoothTransformation(mode="sma", window_size=1)),
        ("smooth(sma,3)", SmaSmoothTransformation(mode="sma", window_size=3)),
        ("smooth(sma,5)", SmaSmoothTransformation(mode="sma", window_size=5)),
        ("smooth( sma , 5 )", SmaSmoothTransformation(mode="sma", window_size=5)),
        ("fill( linear )", FillTransformation(mode="linear")),
        ("fill(locf,)", FillTransformation(mode="locf")),
        ("fill(,locf)", FillTransformation(mode="locf")),
        ("fill(locf,,)", FillTransformation(mode="locf")),
        ("smooth(sma,,5)", SmaSmoothTransformation(mode="sma", window_size=5)),
        ("smooth(sma, ,5)", SmaSmoothTransformation(mode="sma", window_size=5)),
        ("smooth(sma,5,)", SmaSmoothTransformation(mode="sma", window_size=5)),
        ("smooth(ema,3)", EmaSmoothTransformation(mode="ema", window_size=3)),
        ("smooth(ema,7)", EmaSmoothTransformation(mode="ema", window_size=7)),
        ("smooth(asap)", AsapSmoothTransformation(mode="asap")),
        ("smooth(asap,1)", AsapSmoothTransformation(mode="asap", max_window_size=1)),
        ("smooth(asap,7)", AsapSmoothTransformation(mode="asap", max_window_size=7)),
        ("smooth( asap , 7 )", AsapSmoothTransformation(mode="asap", max_window_size=7)),
        ("smooth(asap,,7,)", AsapSmoothTransformation(mode="asap", max_window_size=7)),
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
    result = parse_transformation(value)

    assert result == expected
    assert isinstance(result, type(expected))


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
        ("smooth(asap,7,0.5)", "argument count must be 1 or 2"),
        ("smooth(asap,0)", "Maximum window size must be positive"),
        ("smooth(asap,-1)", "Maximum window size must be positive"),
        ("smooth(asap,2.5)", "max_window_size argument invalid"),
        ("smooth(asap,true)", "max_window_size argument invalid"),
        ("smooth(asap,max_window_size=7)", "max_window_size argument invalid"),
        ('smooth(asap,"7")', "max_window_size argument invalid"),
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


@pytest.mark.parametrize(
    "values, expected",
    [
        ([], []),
        (["fill(locf)"], [FillTransformation(mode="locf")]),
        (["smooth(sma,3)"], [SmaSmoothTransformation(mode="sma", window_size=3)]),
        (
            ("fill( linear )", "smooth(ema,7,0.25)"),
            [
                FillTransformation(mode="linear"),
                EmaSmoothTransformation(mode="ema", window_size=7, smoothing_factor=0.25),
            ],
        ),
        (
            ["smooth(asap,7)", "fill(zero)"],
            [
                AsapSmoothTransformation(mode="asap", max_window_size=7),
                FillTransformation(mode="zero"),
            ],
        ),
    ],
)
def test_parse_transformations(values: Sequence[str], expected: list[Transformation]) -> None:
    assert parse_transformations(values) == expected


@pytest.mark.parametrize(
    "values, message",
    [
        (
            ["fill(locf)", "fill(zero)"],
            "Only one transformation per function type is allowed per yAxis",
        ),
        (
            ["smooth(sma,3)", "smooth(ema,7)"],
            "Only one transformation per function type is allowed per yAxis",
        ),
        (
            ["smooth(asap)", "smooth(ema,7)"],
            "Only one transformation per function type is allowed per yAxis",
        ),
        (
            ["fill(locf)", "smooth(sma,3)", "invalid()"],
            "At most 2 transformations are allowed per yAxis",
        ),
        (["fill(locf)", "fill(invalid)"], "mode argument invalid"),
    ],
)
def test_parse_transformations_invalid(values: list[str], message: str) -> None:
    with pytest.raises(InvalidSearchQuery, match=message):
        parse_transformations(values)


def test_parsed_transformations_with_processing_helpers() -> None:
    fill = parse_transformation("fill(linear)")
    smooth = parse_transformation("smooth(sma,2)")
    assert isinstance(fill, FillTransformation)
    assert isinstance(smooth, SmaSmoothTransformation)

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
    "transformation, expected",
    [
        ("smooth(asap)", [4.0, 5.0, 14 / 3, 5.0, 3.75, 2.5, 1.25] + [0.0] * 13),
        ("smooth(asap,2)", [4.0, 5.0, 5.0, 5.0, 2.5] + [0.0] * 15),
    ],
)
def test_parsed_asap_with_processing_helper(transformation: str, expected: list[float]) -> None:
    config = parse_transformation(transformation)
    assert isinstance(config, AsapSmoothTransformation)
    values = [4.0, 6.0, 4.0, 6.0] + [-1.0, 1.0] * 8

    assert smooth_timeseries(list(range(20)), values, config=config) == pytest.approx(expected)


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
        config=SmaSmoothTransformation(mode=SMOOTH_MODE_SMA, window_size=window_size),
    )

    assert result == expected
    assert result is not values
    assert tuple(values) == original_values
    assert tuple(timestamps) == original_timestamps


def test_smooth_timeseries_sma_equal_weighting() -> None:
    result = smooth_timeseries(
        [0.0, 1.0, 10.0, 20.0],
        [2.0, 4.0, 6.0, 8.0],
        config=SmaSmoothTransformation(mode=SMOOTH_MODE_SMA, window_size=3),
    )

    assert result == [2.0, 3.0, 4.0, 6.0]


@pytest.mark.parametrize(
    "config",
    [
        SmaSmoothTransformation(mode="sma", window_size=3),
        EmaSmoothTransformation(mode="ema", window_size=3),
        AsapSmoothTransformation(mode="asap"),
    ],
)
@pytest.mark.parametrize("timestamps, values", [([0.0], []), ([], [1.0])])
def test_smooth_timeseries_rejects_mismatched_lengths(
    timestamps: list[float],
    values: list[float | None],
    config: SmaSmoothTransformation | EmaSmoothTransformation | AsapSmoothTransformation,
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
        (SmaSmoothTransformation, {}, "mode", "value_error.missing"),
        (SmaSmoothTransformation, {"mode": "sma"}, "window_size", "value_error.missing"),
        (SmaSmoothTransformation, {"mode": "quadratic"}, "mode", "value_error.const"),
        (SmaSmoothTransformation, {"mode": ""}, "mode", "value_error.const"),
        (SmaSmoothTransformation, {"mode": "sma", "window_size": 0}, "window_size", "value_error"),
        (SmaSmoothTransformation, {"mode": "sma", "window_size": -1}, "window_size", "value_error"),
        (
            SmaSmoothTransformation,
            {"mode": "sma", "window_size": True},
            "window_size",
            "value_error",
        ),
        (
            SmaSmoothTransformation,
            {"mode": "sma", "window_size": "3"},
            "window_size",
            "value_error",
        ),
        (
            SmaSmoothTransformation,
            {"mode": "sma", "window_size": 3.0},
            "window_size",
            "value_error",
        ),
        (
            SmaSmoothTransformation,
            {"mode": "sma", "window_size": None},
            "window_size",
            "value_error",
        ),
        (
            SmaSmoothTransformation,
            {"mode": "sma", "window_size": 3, "smoothing_factor": 0.5},
            "smoothing_factor",
            "value_error.extra",
        ),
        (
            SmaSmoothTransformation,
            {"mode": "ema", "window_size": 3},
            "mode",
            "value_error.const",
        ),
        (
            EmaSmoothTransformation,
            {"mode": "sma", "window_size": 3},
            "mode",
            "value_error.const",
        ),
    ],
)
def test_transformation_config_rejects_invalid_values(
    model: type[FillTransformation] | type[SmaSmoothTransformation] | type[EmaSmoothTransformation],
    config: dict[str, object],
    field: str,
    error_type: str,
) -> None:
    with pytest.raises(ValidationError) as error:
        model.parse_obj(config)

    assert error.value.errors()[0]["loc"] == (field,)
    assert error.value.errors()[0]["type"] == error_type


def test_transformation_config_is_immutable() -> None:
    config = SmaSmoothTransformation(mode="sma", window_size=2)

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
    values: Sequence[float | None],
    window_size: int,
    expected: list[float | None],
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


@pytest.mark.parametrize(
    "values, expected",
    [
        pytest.param([], [], id="empty"),
        pytest.param([None, None], [None, None], id="all-missing"),
        pytest.param((None, 0.0, None), [None, 0.0, None], id="single-zero-observation"),
        pytest.param([2.0, -4.0, 8.0], [2.0, -4.0, 8.0], id="short-series"),
        pytest.param([0.0] * 20, [0.0] * 20, id="constant-zero"),
        pytest.param([5.0] * 20, [5.0] * 20, id="constant-nonzero"),
        pytest.param(tuple(range(20)), list(range(20)), id="constant-differences"),
        pytest.param(
            [0.0] * 10 + [20.0] + [0.0] * 9,
            [0.0] * 10 + [20.0] + [0.0] * 9,
            id="kurtosis-rejects-smoothing-a-spike",
        ),
        pytest.param(
            [4.0, 6.0, 4.0, 6.0] + [-1.0, 1.0] * 2 + [-1.0],
            [4.0, 6.0, 4.0, 6.0] + [-1.0, 1.0] * 2 + [-1.0],
            id="nine-buckets-have-no-candidate",
        ),
        pytest.param(
            [0.0, 2.0] * 4 + [0.0, 10.0],
            [0.0] + [1.0] * 8 + [5.0],
            id="ten-buckets-allow-window-two",
        ),
        pytest.param(
            [4.0, 6.0, 4.0, 6.0] + [-1.0, 1.0] * 5,
            [4.0, 5.0, 5.0, 5.0, 2.5] + [0.0] * 9,
            id="fourteen-buckets-allow-window-two",
        ),
        pytest.param(
            [4.0, 6.0, 4.0, 6.0] + [-1.0, 1.0] * 5 + [-1.0],
            [4.0, 5.0, 5.0, 5.0, 2.5] + [0.0] * 10,
            id="fifteen-buckets-floor-window-limit",
        ),
        pytest.param(
            [1.0, -1.0] * 5,
            [1.0, -1.0] * 5,
            id="startup-values-cannot-make-constant-windows-feasible",
        ),
        pytest.param(
            [
                8.0,
                7.0,
                6.0,
                1.0,
                4.0,
                9.0,
                0.0,
                9.0,
                6.0,
                1.0,
                6.0,
                5.0,
                8.0,
                5.0,
                6.0,
                1.0,
                8.0,
                1.0,
                8.0,
                9.0,
            ],
            [
                8.0,
                7.5,
                7.0,
                5.5,
                4.5,
                5.0,
                3.5,
                5.5,
                6.0,
                4.0,
                5.5,
                4.5,
                5.0,
                6.0,
                6.0,
                5.0,
                5.0,
                4.0,
                4.5,
                6.5,
            ],
            id="inclusive-one-fifth-window-limit",
        ),
        pytest.param(
            tuple(value for value in range(14, 33, 2) for _ in range(2)),
            [14.0, 14.0] + list(range(15, 33)),
            id="equal-roughness-prefers-smaller-window",
        ),
    ],
)
def test_smooth_timeseries_asap(
    values: Sequence[float | None], expected: list[float | None]
) -> None:
    timestamps = tuple(float(index**2) for index in range(len(values)))
    original_values = tuple(values)

    result = smooth_timeseries(
        timestamps, values, config=AsapSmoothTransformation(mode=SMOOTH_MODE_ASAP)
    )

    assert result == pytest.approx(expected)
    assert result is not values
    assert tuple(values) == original_values
    assert timestamps == tuple(float(index**2) for index in range(len(values)))


@pytest.mark.parametrize(
    "max_window_size, expected",
    [
        pytest.param(1, [4.0, 6.0, 4.0, 6.0] + [-1.0, 1.0] * 8, id="one-disables-smoothing"),
        pytest.param(2, [4.0, 5.0, 5.0, 5.0, 2.5] + [0.0] * 15, id="restrict-default-search"),
    ],
)
def test_smooth_timeseries_asap_respects_max_window_size(
    max_window_size: int, expected: list[float | None]
) -> None:
    values = [4.0, 6.0, 4.0, 6.0] + [-1.0, 1.0] * 8

    result = smooth_timeseries(
        list(range(20)),
        values,
        config=AsapSmoothTransformation(mode="asap", max_window_size=max_window_size),
    )

    assert result == pytest.approx(expected)


def test_smooth_timeseries_asap_expands_search_across_gaps() -> None:
    values = [None] + [0.0, 2.0] * 3 + [0.0, 5.0, None, 0.0, 0.0, 1.0, None]

    result = smooth_timeseries(
        list(range(len(values))),
        values,
        config=AsapSmoothTransformation(mode="asap", max_window_size=2),
    )

    assert result == pytest.approx([None, 0.0] + [1.0] * 6 + [2.5, None, 0.0, 0.0, 1.0, None])


@pytest.mark.parametrize("values", [[], [None], [1.0], [1.0, 2.0], [0.0, 0.0, 1.0]])
def test_smooth_timeseries_asap_caps_max_window_to_run_length(
    values: list[float | None],
) -> None:
    result = smooth_timeseries(
        list(range(len(values))),
        values,
        config=AsapSmoothTransformation(mode="asap", max_window_size=100),
    )

    assert result == values
    assert result is not values


@pytest.mark.parametrize("max_window_size", [0, -1, True, False, "3", 3.0, float("inf"), []])
def test_asap_config_rejects_invalid_max_window(max_window_size: object) -> None:
    with pytest.raises(ValidationError) as error:
        AsapSmoothTransformation.parse_obj({"mode": "asap", "max_window_size": max_window_size})

    assert error.value.errors()[0]["loc"] == ("max_window_size",)


@pytest.mark.parametrize(
    "config, field",
    [
        ({}, "mode"),
        ({"mode": "ema"}, "mode"),
        ({"mode": "asap", "window_size": 3}, "window_size"),
        ({"mode": "asap", "smoothing_factor": 0.5}, "smoothing_factor"),
    ],
)
def test_asap_config_rejects_invalid_fields(config: dict[str, object], field: str) -> None:
    with pytest.raises(ValidationError) as error:
        AsapSmoothTransformation.parse_obj(config)

    assert error.value.errors()[0]["loc"] == (field,)


def test_asap_config_is_immutable() -> None:
    config = AsapSmoothTransformation(mode="asap", max_window_size=1)

    with pytest.raises(TypeError, match="immutable"):
        setattr(config, "max_window_size", 2)

    assert smooth_timeseries([0.0, 1.0], [2.0, 6.0], config=config) == [2.0, 6.0]


@pytest.mark.parametrize(
    "offset, scale",
    [(0.0, 1e-300), (0.0, 1.0), (0.0, 1e300), (1e308, 1e307), (-1e308, 1e307), (1e16, 4.0)],
)
def test_smooth_timeseries_asap_selects_window_two(offset: float, scale: float) -> None:
    values = tuple(offset + value * scale for value in [4.0, 6.0, 4.0, 6.0] + [-1.0, 1.0] * 5)

    result = smooth_timeseries(
        list(range(14)), values, config=AsapSmoothTransformation(mode="asap")
    )

    assert [(value - offset) / scale for value in result if value is not None] == pytest.approx(
        [4.0, 5.0, 5.0, 5.0, 2.5] + [0.0] * 9
    )


def test_smooth_timeseries_asap_selects_different_windows_across_gaps() -> None:
    values = (
        [None]
        + [4.0, 6.0, 4.0, 6.0]
        + [-1.0, 1.0] * 8
        + [None, None]
        + [
            8.0,
            7.0,
            8.0,
            5.0,
            2.0,
            7.0,
            6.0,
            1.0,
            8.0,
            5.0,
            2.0,
            1.0,
            0.0,
            5.0,
            6.0,
            9.0,
            6.0,
            5.0,
            6.0,
            9.0,
            6.0,
            7.0,
            8.0,
            9.0,
            8.0,
        ]
        + [None, 100.0, -100.0, None]
    )
    original_values = values.copy()

    result = smooth_timeseries(
        list(range(len(values))), values, config=AsapSmoothTransformation(mode=SMOOTH_MODE_ASAP)
    )

    assert result == pytest.approx(
        [None, 4.0, 5.0, 14 / 3, 5.0, 3.75, 2.5, 1.25]
        + [0.0] * 13
        + [None, None]
        + [
            8.0,
            7.5,
            23 / 3,
            20 / 3,
            5.0,
            14 / 3,
            5.0,
            14 / 3,
            5.0,
            14 / 3,
            5.0,
            8 / 3,
            1.0,
            2.0,
            11 / 3,
            20 / 3,
            7.0,
            20 / 3,
            17 / 3,
            20 / 3,
            7.0,
            22 / 3,
            7.0,
            8.0,
            25 / 3,
        ]
        + [None, 100.0, -100.0, None]
    )
    assert values == original_values


def test_smooth_timeseries_asap_composes_with_filling_in_either_order() -> None:
    timestamps = list(range(21))
    values = [4.0, 6.0, 4.0, 6.0] + [-1.0, 1.0] * 8 + [None]

    filled = fill_timeseries(timestamps, values, config=FillTransformation(mode=FILL_MODE_ZERO))
    fill_then_smooth = smooth_timeseries(
        timestamps, filled.values, config=AsapSmoothTransformation(mode=SMOOTH_MODE_ASAP)
    )
    smoothed = smooth_timeseries(
        timestamps, values, config=AsapSmoothTransformation(mode=SMOOTH_MODE_ASAP)
    )
    smooth_then_fill = fill_timeseries(
        timestamps, smoothed, config=FillTransformation(mode=FILL_MODE_ZERO)
    )

    assert fill_then_smooth == pytest.approx(
        [4.0, 5.0, 14 / 3, 5.0, 3.75, 2.5, 1.25] + [0.0] * 13 + [0.25]
    )
    assert smooth_then_fill.values == pytest.approx(
        [4.0, 5.0, 14 / 3, 5.0, 3.75, 2.5, 1.25] + [0.0] * 14
    )
    assert filled.filled == smooth_then_fill.filled == [False] * 20 + [True]


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
def test_smooth_timeseries_asap_rejects_nonfinite_observations(value: float) -> None:
    with pytest.raises(ValueError, match="ASAP observations must be finite"):
        smooth_timeseries(
            [0.0, 1.0], [1.0, value], config=AsapSmoothTransformation(mode=SMOOTH_MODE_ASAP)
        )


def test_smooth_timeseries_asap_preserves_values_when_rescaling_overflows() -> None:
    offsets = [0, 0, 0, 1, 0, 1, 1, 2, 3, 0, 0, 65, 43, 0, 25]
    values = [(1 - offset * 2**-53) * sys.float_info.max for offset in offsets]

    result = smooth_timeseries(
        list(range(15)), values, config=AsapSmoothTransformation(mode=SMOOTH_MODE_ASAP)
    )

    assert result == values
    assert result is not values
