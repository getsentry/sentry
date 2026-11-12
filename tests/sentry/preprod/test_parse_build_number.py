import pytest

from sentry.preprod.build_distribution_utils import (
    _BUILD_NUMBER_COMPONENT_WIDTH,
    ParsedBuildNumber,
)
from sentry.utils.numbers import validate_bigint


@pytest.mark.parametrize(
    "build,expected",
    [
        # Plain integers (e.g. Android versionCode) pass through unchanged
        ("9999", 9999),
        ("0", 0),
        ("1", 1),
        # Apple CFBundleVersion: two or three dot-separated non-negative integers
        ("1.2.3", 1_000_002_000_003),
        ("1.2", 1_000_002_000_000),
        # CFBundleVersion allows more than three groups; groups beyond the
        # third are dropped
        ("1.2.3.4", 1_000_002_000_003),
        ("1.2.3.4.5", 1_000_002_000_003),
        ("1.2.3.0", 1_000_002_000_003),
        # Dropped groups are not width-checked, but must still be numeric
        ("1.2.3.1234567", 1_000_002_000_003),
        ("1.2.3.beta", None),
        ("1.2.3.", None),
        # Malformed or unsupported shapes fall back to None
        ("1.2.a", None),
        ("abc", None),
        ("", None),
        # A component too wide for the padding width is refused rather than
        # silently corrupting the ordering of adjacent components
        ("1234567.2.3", None),
        # Unicode "digits" that int() cannot parse (isdigit() True, isdecimal() False)
        ("²", None),
        ("1.²", None),
        # Largest value the build_number column can hold passes through
        ("9223372036854775807", 9223372036854775807),
        # One past I64_MAX overflows the column, so it is rejected rather than
        # blowing up query prep
        ("9223372036854775808", None),
        ("99999999999999999999999999", None),
        # Surrounding whitespace is trimmed, matching int()'s old tolerance
        ("  42  ", 42),
        (" 1.2.3 ", 1_000_002_000_003),
    ],
)
def test_parse_build_number(build: str, expected: int | None) -> None:
    parsed = ParsedBuildNumber.parse(build)
    assert (parsed.encoded if parsed else None) == expected


def test_parsed_build_number_preserves_trimmed_input() -> None:
    assert ParsedBuildNumber.parse(" 152.0.4191.9 ") == ParsedBuildNumber(
        raw="152.0.4191.9",
        encoded=152_000_000_004_191,
    )


def test_dotted_builds_sort_correctly_within_a_version() -> None:
    lower = ParsedBuildNumber.parse("1.99")
    higher = ParsedBuildNumber.parse("2.0")
    assert lower is not None
    assert higher is not None
    assert lower.encoded < higher.encoded


def test_distinguishes_builds_that_naive_concatenation_would_collide() -> None:
    # "1.2.3", "12.3", and "1.23" would all naively concatenate to "123".
    first = ParsedBuildNumber.parse("1.2.3")
    second = ParsedBuildNumber.parse("12.3")
    third = ParsedBuildNumber.parse("1.23")
    assert first is not None
    assert second is not None
    assert third is not None
    assert first.encoded != second.encoded
    assert first.encoded != third.encoded


def test_largest_dotted_build_fits_the_bigint_column() -> None:
    widest_component = "9" * _BUILD_NUMBER_COMPONENT_WIDTH
    largest = f"{widest_component}.{widest_component}.{widest_component}"
    parsed = ParsedBuildNumber.parse(largest)
    assert parsed is not None
    assert validate_bigint(parsed.encoded)
