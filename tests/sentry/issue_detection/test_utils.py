from __future__ import annotations

from collections.abc import Generator
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from sentry.issue_detection.detectors.utils import (
    get_numeric_value_from_span,
    parameterize_url_with_result,
    safer_urlparse,
    span_has_obfuscated_hostname,
)
from sentry.testutils.issue_detection.event_generators import create_span


@pytest.fixture
def mock_log_invalid_data() -> Generator[MagicMock]:
    with patch(
        "sentry.issue_detection.detectors.utils.log_invalid_span_data"
    ) as mock_log_invalid_data:
        yield mock_log_invalid_data


class TestDetectorUtils:
    @pytest.mark.parametrize(
        ("url", "expected_result"),
        [
            ("https://[Filtered]/dogs/1121", True),
            ("https://[Redacted IP]/dogs/1231", True),
            ("https://[dogs].are.great/dogs/908", True),
            ("https://[Filtered]:8080/dogs/415", True),
            ("https://user:[Filtered]@dogs.are.great/x", True),
            ("//[Filtered]/dogs/2012", True),  # protocol-relative
            ("https://[4.15.9.8]/dogs/2013", False),  # a real IP address
            ("https://dogs.are.great/dogs/[number]", False),
            ("https://dogs.are.great/dogs/[filtered id]", False),
            ("https://dogs.are.great/dogs/1121", False),
            ("https://dogs.are.great/dogs/1231?year=2012", False),
        ],
    )
    def test_span_has_obfuscated_hostname(self, url: str, expected_result: bool) -> None:
        span = create_span("http.client", 320415204, f"GET {url}")
        assert span_has_obfuscated_hostname(span) == expected_result

    @pytest.mark.parametrize(
        ("url", "expected_netloc"),
        [
            ("https://[Filtered]/dogs/1121", "[Filtered]"),
            ("https://[Redacted IP]/dogs/1231", "[Redacted IP]"),
            ("https://[dogs].are.great/dogs/908", "[dogs].are.great"),
            ("https://[Filtered]:8080/dogs/415", "[Filtered]:8080"),
            ("https://user:[Filtered]@dogs.are.great/x", "user:[Filtered]@dogs.are.great"),
            ("//[Filtered]/dogs/2012", "[Filtered]"),  # protocol-relative
            ("https://[4.15.9.8]/dogs/2013", "[4.15.9.8]"),  # a real IP address
            ("https://dogs.are.great/dogs/[number]", "dogs.are.great"),
            ("https://dogs.are.great/dogs/[filtered id]", "dogs.are.great"),
            ("https://dogs.are.great/dogs/1121", "dogs.are.great"),
            ("https://dogs.are.great/dogs/1231?year=2012", "dogs.are.great"),
        ],
    )
    def test_safe_urlparse(self, url: str, expected_netloc: str) -> None:
        assert safer_urlparse(url).netloc == expected_netloc

    @pytest.mark.parametrize(
        ("url", "expected_result_data"),  # Expected result is (url, path_params, query_params)
        [
            (
                "https://[Filtered]/dogs/1121",
                ("https://[Filtered]/dogs/*", ["1121"], {}),
            ),
            (
                "https://[Redacted IP]/dogs/1231",
                ("https://[Redacted IP]/dogs/*", ["1231"], {}),
            ),
            (
                "https://[dogs].are.great/dogs/908",
                ("https://[dogs].are.great/dogs/*", ["908"], {}),
            ),
            (
                "https://[Filtered]:8080/dogs/415",
                ("https://[Filtered]:8080/dogs/*", ["415"], {}),
            ),
            (
                "https://user:[Filtered]@dogs.are.great/x",
                ("https://user:[Filtered]@dogs.are.great/x", [], {}),
            ),
            (
                "//[Filtered]/dogs/2012",  # protocol-relative
                ("[Filtered]/dogs/*", ["2012"], {}),
            ),
            (
                "https://[4.15.9.8]/dogs/2013",  # a real IP address
                ("https://[4.15.9.8]/dogs/*", ["2013"], {}),
            ),
            (
                "https://dogs.are.great/dogs/[number]",
                ("https://dogs.are.great/dogs/*", ["[number]"], {}),
            ),
            (
                "https://dogs.are.great/dogs/[filtered id]",
                ("https://dogs.are.great/dogs/*", ["[filtered id]"], {}),
            ),
            (
                "https://dogs.are.great/dogs/1121",
                ("https://dogs.are.great/dogs/*", ["1121"], {}),
            ),
            (
                "https://dogs.are.great/dogs/1231?year=2012",
                ("https://dogs.are.great/dogs/*?year=*", ["1231"], {"year": ["2012"]}),
            ),
        ],
    )
    def test_parameterize_url_with_result(
        self, url: str, expected_result_data: tuple[str, list[str], dict[str, list[str]]]
    ) -> None:
        parameterized_url, path_params, query_params = expected_result_data

        assert parameterize_url_with_result(url) == {
            "url": parameterized_url,
            "path_params": path_params,
            "query_params": query_params,
        }


class TestGetNumericValueFromSpan:
    @pytest.mark.parametrize(
        ("value", "number_type", "expected_result"),
        [
            # Values which are already the type we want
            (1121, int, 1121),
            (12.31, float, 12.31),
            # Strings we can convert directly
            ("1121", int, 1121),
            ("12.31", float, 12.31),
            # Ints are fine when we want floats - they're just missing decimals. The reverse
            # generally isn't okay, since converting would lose data. The one exception is
            # whole-number floats, which convert just fine.
            (1121, float, 1121.0),
            (1231.0, int, 1231),
            (11.21, int, Exception),
            # All of the above still holds if the values start out as strings
            ("1121", float, 1121.0),
            ("1231.0", int, 1231),
            ("11.21", int, Exception),
            # Bools are technically ints, but they're not what we're after
            (True, int, Exception),
            (True, float, Exception),
            (False, int, Exception),
            (False, float, Exception),
            # Similarly, `NaN`-strings can be converted to floats, but also aren't what we want
            ("NaN", int, Exception),
            ("NaN", float, Exception),
            # Values which aren't numbers at all
            ("dogs", int, Exception),
            ("dogs", float, Exception),
            ("", int, Exception),
            ("", float, Exception),
            ({"maisey": 1231}, int, Exception),
            ({"maisey": 1231}, float, Exception),
            ([1231], int, Exception),
            ([1231], float, Exception),
        ],
    )
    def test_value_found(
        self,
        value: Any,
        number_type: type[int] | type[float],
        expected_result: int | float | type[Exception],
        mock_log_invalid_data: MagicMock,
    ) -> None:
        span = create_span("do.dog.stuff", data={"dogs_are_great": value})
        keys = ["dogs_are_great"]
        default = 0 if number_type is int else 0.0

        result_without_default = get_numeric_value_from_span(
            span, keys, "dog_detector", number_type
        )
        result_with_default = get_numeric_value_from_span(
            span, keys, "dog_detector", number_type, default=default
        )

        if expected_result is Exception:
            assert result_without_default is None
            assert result_with_default == default
            # Invalid data logging happens even when we have a default value to return
            assert mock_log_invalid_data.call_count == 2
        else:
            assert result_without_default == expected_result
            assert isinstance(result_without_default, number_type)
            assert result_with_default == expected_result
            assert isinstance(result_with_default, number_type)
            assert mock_log_invalid_data.call_count == 0

    @pytest.mark.parametrize(
        "data",
        [
            None,  # No span data
            {},  # Empty span data
            {"adopt_dont_shop": 1121},  # Span data exists but desired key doesn't
            {"dogs_are_great": None},  # Desired key exists but has no value
        ],
    )
    def test_value_not_found(
        self, data: dict[str, Any] | None, mock_log_invalid_data: MagicMock
    ) -> None:
        span = create_span("do.dog.stuff", data=data)
        keys = ["dogs_are_great"]

        # Returns the default value (if given) or `None` (if not)
        assert get_numeric_value_from_span(span, keys, "dog_detector", int) is None
        assert get_numeric_value_from_span(span, keys, "dog_detector", int, default=1231) == 1231
        # Either way, missing data isn't invalid data, so there's nothing to log
        assert mock_log_invalid_data.call_count == 0

    def test_uses_first_key_with_a_value(self, mock_log_invalid_data: MagicMock) -> None:
        span = create_span("do.dog.stuff", data={"adopt_dont_shop": 1121, "dogs_are_great": 1231})
        keys = ["dogs_are_great", "adopt_dont_shop"]

        assert get_numeric_value_from_span(span, keys, "dog_detector", int) == 1231
        assert mock_log_invalid_data.call_count == 0

    def test_falls_back_to_later_keys(self, mock_log_invalid_data: MagicMock) -> None:
        span = create_span("do.dog.stuff", data={"adopt_dont_shop": 1121})
        keys = ["dogs_are_great", "adopt_dont_shop"]

        assert get_numeric_value_from_span(span, keys, "dog_detector", int) == 1121
        assert mock_log_invalid_data.call_count == 0
