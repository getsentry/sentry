from __future__ import annotations

import logging

import pytest
from django.test import RequestFactory
from rest_framework.exceptions import ParseError
from rest_framework.request import Request

from sentry.api.helpers.timeseries_transformations import (
    AsapSmoothTransformation,
    EmaSmoothTransformation,
    FillTransformation,
    SmaSmoothTransformation,
    Transformation,
    get_transformations,
)


@pytest.mark.parametrize(
    "query, expected",
    [
        ("", {}),
        ("transformationsExtra=ignored&query=anything", {}),
        ("transformations[0]=fill(locf)", {0: [FillTransformation(mode="locf")]}),
        ("transformations[0]=smooth(asap)", {0: [AsapSmoothTransformation(mode="asap")]}),
        (
            "transformations[0]=smooth(asap,7)&transformations[0]=fill(zero)",
            {
                0: [
                    AsapSmoothTransformation(mode="asap", max_window_size=7),
                    FillTransformation(mode="zero"),
                ]
            },
        ),
        (
            "transformations[0]=smooth(sma,,5)",
            {0: [SmaSmoothTransformation(mode="sma", window_size=5)]},
        ),
        (
            "transformations[0]=smooth(sma,5)&transformations[0]=fill(zero)",
            {
                0: [
                    SmaSmoothTransformation(mode="sma", window_size=5),
                    FillTransformation(mode="zero"),
                ]
            },
        ),
        (
            "yAxis=count()&yAxis=count()&transformations[1]=fill(locf)"
            "&transformations[1]=smooth(sma,3)&transformations[0]=fill(zero)",
            {
                1: [
                    FillTransformation(mode="locf"),
                    SmaSmoothTransformation(mode="sma", window_size=3),
                ],
                0: [FillTransformation(mode="zero")],
            },
        ),
        (
            "yAxis=count()&yAxis=avg(span.duration)&yAxis=p90(span.duration)"
            "&transformations[2]=smooth(sma,3)",
            {2: [SmaSmoothTransformation(mode="sma", window_size=3)]},
        ),
        (
            "transformations[0]=smooth(ema,7)",
            {0: [EmaSmoothTransformation(mode="ema", window_size=7)]},
        ),
        (
            "transformations[0]=smooth(ema,7,0.25)&transformations[0]=fill(linear)",
            {
                0: [
                    EmaSmoothTransformation(mode="ema", window_size=7, smoothing_factor=0.25),
                    FillTransformation(mode="linear"),
                ]
            },
        ),
    ],
)
def test_decode_transformations(query: str, expected: dict[int, list[Transformation]]) -> None:
    request = Request(RequestFactory().get(f"/events-timeseries/?{query}"))

    assert get_transformations(request) == expected


@pytest.mark.parametrize(
    "key",
    [
        "transformations",
        "transformations[]",
        "transformations[-1]",
        "transformations[abc]",
        "transformations[01]",
        "transformations[0][]",
        "transformations[0]extra",
        "transformations[0",
        "transformations[٠]",
        pytest.param(f"transformations[{'9' * 5000}]", id="oversized-index"),
    ],
)
def test_decode_transformations_invalid_key(key: str) -> None:
    request = Request(RequestFactory().get("/events-timeseries/", {key: "fill(locf)"}))

    with pytest.raises(ParseError, match="Invalid transformations index"):
        get_transformations(request)


@pytest.mark.parametrize(
    "query",
    [
        "transformations[1]=fill(locf)",
        "yAxis=count()&yAxis=avg(span.duration)&transformations[2]=fill(locf)",
        "transformations[1000000000]=fill(locf)",
    ],
)
def test_decode_transformations_index_out_of_range(query: str) -> None:
    request = Request(RequestFactory().get(f"/events-timeseries/?{query}"))

    with pytest.raises(ParseError, match="transformations index must match a yAxis position"):
        get_transformations(request)


@pytest.mark.parametrize(
    "value, expected",
    [
        ("", " is not a valid transformation"),
        ("[fill(locf), smooth(sma)]", "[fill(locf), smooth(sma)] is not a valid transformation"),
        (
            "fill(sma)",
            "fill(sma): mode argument invalid: expected one of locf, zero, linear",
        ),
        (
            "smooth(sma,0)",
            "smooth(sma,0): window_size argument invalid: Window size must be positive.",
        ),
        ("fill()", "fill(): argument count must be 1"),
        ("smooth()", "smooth(): argument count must be 2"),
        ("smooth(sma)", "smooth(sma): argument count must be 2"),
        ("fill(locf,zero)", "fill(locf,zero): argument count must be 1"),
        ("smooth(sma,5,6)", "smooth(sma,5,6): argument count must be 2"),
        ("smooth(ema)", "smooth(ema): argument count must be 2 or 3"),
        ("smooth(asap,7,0.5)", "smooth(asap,7,0.5): argument count must be 1 or 2"),
        (
            "smooth(asap,0)",
            "smooth(asap,0): max_window_size argument invalid: Maximum window size must be positive.",
        ),
        ("smooth(ema,7,0.5,1)", "smooth(ema,7,0.5,1): argument count must be 2 or 3"),
        (
            "smooth(ema,7,0)",
            "smooth(ema,7,0): smoothing_factor argument invalid: "
            "Smoothing factor must be greater than zero and at most one.",
        ),
    ],
)
def test_decode_transformations_invalid_value(
    value: str, expected: str, caplog: pytest.LogCaptureFixture
) -> None:
    request = Request(
        RequestFactory().get("/events-timeseries/", {"transformations[0]": ["fill(locf)", value]})
    )

    with caplog.at_level(logging.INFO, logger="sentry.api.utils"):
        with pytest.raises(ParseError) as error:
            get_transformations(request)

    assert error.value.detail == expected
    assert caplog.record_tuples == [("sentry.api.utils", logging.INFO, "A query error was handled")]
    assert getattr(caplog.records[0], "query.error_reason") == expected


@pytest.mark.parametrize(
    "values, expected",
    [
        (
            ["fill(locf)", "fill(zero)"],
            "Only one transformation per function type is allowed per yAxis",
        ),
        (
            ["smooth(asap,7)", "smooth(ema,3)"],
            "Only one transformation per function type is allowed per yAxis",
        ),
        (
            ["fill(zero)", "smooth(sma,3)", "fill(locf)"],
            "At most 2 transformations are allowed per yAxis",
        ),
    ],
)
def test_decode_transformations_rejects_repeated_functions(
    values: list[str], expected: str
) -> None:
    request = Request(RequestFactory().get("/events-timeseries/", {"transformations[0]": values}))

    with pytest.raises(ParseError) as error:
        get_transformations(request)

    assert error.value.detail == expected
