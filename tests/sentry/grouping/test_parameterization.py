import pytest

from sentry.grouping.parameterization import Parameterizer
from sentry.grouping.strategies.message import REGEX_PATTERN_KEYS


@pytest.fixture
def parameterizer() -> Parameterizer:
    return Parameterizer(regex_pattern_keys=REGEX_PATTERN_KEYS)


@pytest.mark.parametrize(
    ("name", "input", "expected"),
    [
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
        ("hex", "0x9af8c3b", "<hex>"),
        ("hex", "9af8c3b0", "<hex>"),
        ("hex", "9af8c3b09af8c3b0", "<hex>"),
        ("hex - missing numbers", "aaffccbb", "aaffccbb"),
        (
            "hex - not 4 or 8 bytes",
            "4aaa 9aaaaaaaa 10aaaaaaaa 15aaaaaaaaaaaaa 17aaaaaaaaaaaaaaa",
            "4aaa 9aaaaaaaa 10aaaaaaaa 15aaaaaaaaaaaaa 17aaaaaaaaaaaaaaa",
        ),
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
    ],
)
def test_parameterize_standard(
    name: str, input: str, expected: str, parameterizer: Parameterizer
) -> None:
    assert expected == parameterizer.parameterize_all(input)
    assert f"prefix {expected}" == f"prefix {parameterizer.parameterize_all(input)}"
    assert f"{expected} suffix" == f"{parameterizer.parameterize_all(input)} suffix"
    assert f"prefix {expected} suffix" == f"prefix {parameterizer.parameterize_all(input)} suffix"


# These are test cases that we should fix
@pytest.mark.xfail()
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
    assert expected == parameterizer.parameterize_all(input), f"Case {name} Failed"


# These are test cases were we're too aggressive
@pytest.mark.xfail()
@pytest.mark.parametrize(
    ("name", "input", "expected"),
    [
        ("Not an Int", "Encoding: utf-8", "Encoding: utf-8"),  # produces "Encoding: utf<int>"
    ],
)
def test_too_aggressive_parameterize(
    name: str, input: str, expected: str, parameterizer: Parameterizer
) -> None:
    assert expected == parameterizer.parameterize_all(input), f"Case {name} Failed"
