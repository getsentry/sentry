import pytest

from sentry.issue_detection.detectors.utils import (
    parameterize_url_with_result,
    safer_urlparse,
    span_has_obfuscated_hostname,
)
from sentry.testutils.issue_detection.event_generators import create_span


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
