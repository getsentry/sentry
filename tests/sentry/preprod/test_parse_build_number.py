import pytest

from sentry.preprod.build_distribution_utils import parse_build_number


@pytest.mark.parametrize(
    "build,expected",
    [
        # Plain integers (e.g. Android versionCode) pass through unchanged
        ("9999", 9999),
        ("0", 0),
        ("1", 1),
        # Apple CFBundleVersion: up to three dot-separated non-negative integers
        ("1.2.3", 1_000_002_000_003),
        ("1.2", 1_000_002_000_000),
        # Malformed or unsupported shapes fall back to None
        ("1.2.a", None),
        ("abc", None),
        ("1.2.3.4", None),
        ("", None),
        # A component too wide for the padding width is refused rather than
        # silently corrupting the ordering of adjacent components
        ("1234567.2.3", None),
    ],
)
def test_parse_build_number(build: str, expected: int | None) -> None:
    # Must stay in sync with launchpad's _parse_build_number so a client-supplied
    # build code expands to the same sortable int launchpad stored on the artifact.
    assert parse_build_number(build) == expected


def test_dotted_builds_sort_correctly_within_a_version() -> None:
    assert parse_build_number("1.99") < parse_build_number("2.0")  # type: ignore[operator]


def test_distinguishes_builds_that_naive_concatenation_would_collide() -> None:
    # "1.2.3", "12.3", and "1.23" would all naively concatenate to "123".
    assert parse_build_number("1.2.3") != parse_build_number("12.3")
    assert parse_build_number("1.2.3") != parse_build_number("1.23")
