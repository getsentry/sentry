import pytest

from sentry.utils.csv import escape_csv_value


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("=1+1", "'=1+1"),
        ("+1", "'+1"),
        ("-1", "'-1"),
        ("@SUM(A1)", "'@SUM(A1)"),
        (" =1+1", "' =1+1"),
        ("\t=cmd", "'\t=cmd"),
        ("\r=cmd", "'\r=cmd"),
        ("a=1", "a=1"),
        ("", ""),
        ("'=1+1", "'=1+1"),
    ],
)
def test_escape_csv_value_strings(value: str, expected: str) -> None:
    assert escape_csv_value(value) == expected


@pytest.mark.parametrize("value", [-1, -1.5, None, ["=1+1"]])
def test_escape_csv_value_non_strings(value: object) -> None:
    assert escape_csv_value(value) == value
