import pytest

from sentry.grouping.parameterization import Parameterizer


@pytest.fixture
def parameterizer() -> Parameterizer:
    return Parameterizer(experimental=False)


@pytest.fixture
def experimental_parameterizer() -> Parameterizer:
    return Parameterizer(experimental=True)


standard_cases = [
    ("email", "test@email.com", "<email>"),
    ("url", "http://some.email.com", "<url>"),
    ("url - existing behavior", "tcp://user:pass@email.com:10", "tcp://user:<email>:<int>"),
    ("hostname - tld", "example.com", "<hostname>"),
    ("hostname - subdomain", "www.example.net", "<hostname>"),
    ("ip", "0.0.0.0", "<ip>"),
    (
        "traceparent - header",
        "traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
        "traceparent: <traceparent>",
    ),
    ("traceparent - aws", "1-67891233-abcdef012345678912345678", "<traceparent>"),
    (
        "traceparent - aws, but not word boundary",
        "abc1-67891233-abcdef012345678912345678",
        "abc1<int>-<hex>",
    ),
    ("uuid", "7c1811ed-e98f-4c9c-a9f9-58c757ff494f", "<uuid>"),
    (
        "uuid - multiple",
        "bea691f2-2e25-4bec-6838-e0c44b03d60a/7c1811ed-e98f-4c9c-a9f9-58c757ff494f",
        "<uuid>/<uuid>",
    ),
    ("sha1", "5fc35719b9cf96ec602dbc748ff31c587a46961d", "<sha1>"),
    ("md5", "0751007cd28df267e8e051b51f918c60", "<md5>"),
    ("date", "2024-02-20T22:16:36", "<date>"),
    ("date - RFC822", "Mon, 02 Jan 06 15:04 MST", "<date>"),
    ("date - RFC822Z", "Mon, 02 Jan 06 15:04 -0700", "<date>"),
    ("date - RFC850 abbreviated weekday", "Mon, 02-Jan-06 15:04:05 MST", "<date>"),
    ("date - RFC850 full weekday", "Monday, 02-Jan-06 15:04:05 MST", "<date>"),
    ("date - RFC1123", "Mon, 02 Jan 2006 15:04:05 MST", "<date>"),
    ("date - RFC1123Z", "Mon, 02 Jan 2006 15:04:05 -0700", "<date>"),
    ("date - JS minus", "Mon Jan 02 2006 14:04:05 GMT-0800 (Pacific Standard Time)", "<date>"),
    ("date - JS utc", "Mon Jan 02 2006 14:04:05 GMT+0000 (UTC)", "<date>"),
    ("date - JS plus", "Mon Jan 02 2006 14:04:05 GMT+0800 (Pacific Standard Time)", "<date>"),
    ("date - JS minus without tz", "Mon Jan 02 2006 14:04:05 GMT-0800", "<date>"),
    ("date - JS utc without tz", "Mon Jan 02 2006 14:04:05 GMT+0000", "<date>"),
    ("date - JS plus without tz", "Mon Jan 02 2006 14:04:05 GMT+0800", "<date>"),
    ("date - RFC3339", "2006-01-02T15:04:05Z07:00", "<date>"),
    ("date - RFC3339 without offset", "2006-01-02T15:04:05Z", "<date>"),
    ("date - RFC3339Nano", "2006-01-02T15:04:05.999999999Z07:00", "<date>"),
    ("date - RFC3339Nano without offset", "2006-01-02T15:04:05.999999999Z", "<date>"),
    ("date - plain", "2006-01-02", "<date>"),
    ("date - long", "Jan 18, 2019", "<date>"),
    ("date - datetime", "2006-01-02 15:04:05", "<date>"),
    ("date - kitchen", "3:04PM", "<date>"),
    ("date - time", "15:04:05", "<date>"),
    ("date - basic", "Mon Jan 02, 1999", "<date>"),
    ("date - compressed", "20240220 11:55:33.546593", "<date>"),
    ("date - datestamp", "2024-02-23 02:13:53.418", "<date>"),
    ("date - datetime", "datetime.datetime(2025, 6, 24, 18, 33, 0, 447640)", "<date>"),
    ("duration - 0ms", "0ms", "<duration>"),
    ("duration - 1ms", "1ms", "<duration>"),
    ("duration - 10ms", "10ms", "<duration>"),
    ("duration - 1000000ms", "1000000ms", "<duration>"),
    ("duration - 0s", "0s", "<duration>"),
    ("duration - 0.100s", "0.100s", "<duration>"),
    ("duration - 1.234s", "1.234s", "<duration>"),
    ("duration - 10s", "10s", "<duration>"),
    ("duration - 100.0000s", "100.0000s", "<duration>"),
    # OpenStack Swift transaction IDs
    ("swift_txn_id - base", "tx274a77a8975c4a66aeb24-0052d95365", "<swift_txn_id>"),
    (
        "swift_txn_id - with suffix",
        "tx274a77a8975c4a66aeb24-0052d95365-cluster01",
        "<swift_txn_id>",
    ),
    (
        "swift_txn_id - not matching prefix",
        "ab274a77a8975c4a66aeb24-0052d95365",
        "<hex>-0052d95365",
    ),
    ("hex with prefix - lowercase, 4 digits", "0x9af8", "<hex>"),
    ("hex with prefix - uppercase, 4 digits", "0x9AF8", "<hex>"),
    ("hex with prefix - lowercase, 8 digits", "0x9af8c3be", "<hex>"),
    ("hex with prefix - uppercase, 8 digits", "0x9AF8C3BE", "<hex>"),
    ("hex with prefix - lowercase, 10 digits", "0x9af8c3be3a", "<hex>"),
    ("hex with prefix - uppercase, 10 digits", "0x9AF8C3BE3A", "<hex>"),
    ("hex with prefix - lowercase, 16 digits", "0x9af8c3be3a1231fe", "<hex>"),
    ("hex with prefix - uppercase, 16 digits", "0x9AF8C3BE3A1231FE", "<hex>"),
    ("hex with prefix - lowercase, 24 digits", "0x9af8c3be3a1231fe1121acb1", "<hex>"),
    ("hex with prefix - uppercase, 24 digits", "0x9AF8C3BE3A1231FE1121ACB1", "<hex>"),
    ("hex with prefix - lowercase, no numbers", "0xdeadbeef", "<hex>"),
    ("hex with prefix - uppercase, no numbers", "0xDEADBEEF", "<hex>"),
    ("hex without prefix - lowercase, 4 digits", "9af8", "9af8"),
    ("hex without prefix - uppercase, 4 digits", "9AF8", "9AF8"),
    ("hex without prefix - lowercase, 8 digits", "9af8c3be", "<hex>"),
    ("hex without prefix - uppercase, 8 digits", "9AF8C3BE", "<hex>"),
    ("hex without prefix - lowercase, 10 digits", "9af8c3be3a", "9af8c3be3a"),
    ("hex without prefix - uppercase, 10 digits", "9AF8C3BE3A", "9AF8C3BE3A"),
    ("hex without prefix - lowercase, 16 digits", "9af8c3be3a1231fe", "<hex>"),
    ("hex without prefix - uppercase, 16 digits", "9AF8C3BE3A1231FE", "<hex>"),
    ("hex without prefix - lowercase, 24 digits", "9af8c3be3a1231fe1121acb1", "<hex>"),
    ("hex without prefix - uppercase, 24 digits", "9AF8C3BE3A1231FE1121ACB1", "<hex>"),
    ("hex without prefix - lowercase, no numbers", "deadbeef", "deadbeef"),
    ("hex without prefix - uppercase, no numbers", "DEADBEEF", "DEADBEEF"),
    ("float", "0.23", "<float>"),
    ("int", "23", "<int>"),
    ("int - separator", "0:17502", "<int>:<int>"),
    ("int - parens", '{"msg" => "(#239323)', '{"msg" => "(#<int>)'),
    ("int - date - invalid day", "2006-01-40", "<int><int><int>"),
    ("int - date - invalid month", "2006-20-02", "<int><int><int>"),
    ("int - date - invalid year", "10000-01-02", "<int><int><int>"),
    ("int - date - missing day", "2006-01", "<int><int>"),
    ("int - quoted_str whitespace", "b = '1'", "b = '<int>'"),
    ("int - quoted_str whitespace", 'b = "1"', 'b = "<int>"'),
    ("quoted_str - single", "b='1'", "b=<quoted_str>"),
    ("quoted_str - double", 'b="1"', "b=<quoted_str>"),
    ("quoted_str - complex", 'b="0.0.0.0 1 a=True"', "b=<quoted_str>"),
    ("quoted_str - mismatch", "b='value\"", "b='value\""),
    ("quoted_str - mismatch", "b=\"value'", "b=\"value'"),
    ("bool", "a=false", "a=<bool>"),
    ("bool", "a=False", "a=<bool>"),
    ("bool", "a=true", "a=<bool>"),
    ("bool", "a=True", "a=<bool>"),
    ("bool - missing equal", "False", "False"),
    ("bool - missing equal", "true", "true"),
    ("bool - whitespace", "a = False", "a = False"),
    ("bool - whitespace", "a = true", "a = true"),
    ("None", "A quick brown fox", "A quick brown fox"),
    ("Multiple - ip:port", "0.0.0.0:80", "<ip>:<int>"),
]

experimental_cases: list[tuple[str, str, str]] = [
    # None at this time.
]


@pytest.mark.parametrize(("name", "input", "expected"), standard_cases)
def test_parameterize_standard(
    name: str, input: str, expected: str, parameterizer: Parameterizer
) -> None:
    assert parameterizer.parameterize_all(input) == expected
    assert parameterizer.parameterize_all(f"prefix {input}") == f"prefix {expected}"
    assert parameterizer.parameterize_all(f"{input} suffix") == f"{expected} suffix"
    assert parameterizer.parameterize_all(f"prefix {input} suffix") == f"prefix {expected} suffix"


@pytest.mark.parametrize(("name", "input", "expected"), experimental_cases)
def test_parameterize_standard_not_experimental(
    name: str, input: str, expected: str, parameterizer: Parameterizer
) -> None:
    assert parameterizer.parameterize_all(input) != expected
    assert parameterizer.parameterize_all(f"prefix {input}") != f"prefix {expected}"
    assert parameterizer.parameterize_all(f"{input} suffix") != f"{expected} suffix"
    assert parameterizer.parameterize_all(f"prefix {input} suffix") != f"prefix {expected} suffix"


@pytest.mark.parametrize(("name", "input", "expected"), standard_cases + experimental_cases)
def test_parameterize_experimental(
    name: str, input: str, expected: str, experimental_parameterizer: Parameterizer
) -> None:
    assert experimental_parameterizer.parameterize_all(input) == expected
    assert experimental_parameterizer.parameterize_all(f"prefix {input}") == f"prefix {expected}"
    assert experimental_parameterizer.parameterize_all(f"{input} suffix") == f"{expected} suffix"
    assert (
        experimental_parameterizer.parameterize_all(f"prefix {input} suffix")
        == f"prefix {expected} suffix"
    )


# These are test cases that we should fix
@pytest.mark.xfail(strict=True)
@pytest.mark.parametrize(
    ("name", "input", "expected"),
    [
        (
            "URL - non-http protocol user/pass/port",
            """blah tcp://user:pass@email.com:10 had a problem""",
            """blah <url> had a problem""",
        ),
    ],
)
def test_fail_parameterize(
    name: str, input: str, expected: str, parameterizer: Parameterizer
) -> None:
    assert parameterizer.parameterize_all(input) == expected


# These are test cases where we're too aggressive
@pytest.mark.xfail(strict=True)
@pytest.mark.parametrize(
    ("name", "input", "expected"),
    [
        ("Not an Int", "Encoding: utf-8", "Encoding: utf-8"),  # produces "Encoding: utf<int>"
    ],
)
def test_too_aggressive_parameterize(
    name: str, input: str, expected: str, parameterizer: Parameterizer
) -> None:
    assert parameterizer.parameterize_all(input) == expected
