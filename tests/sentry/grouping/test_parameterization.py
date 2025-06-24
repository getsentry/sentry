import pytest

from sentry.grouping.parameterization import Parameterizer
from sentry.grouping.strategies.message import REGEX_PATTERN_KEYS


@pytest.fixture
def parameterizer():
    return Parameterizer(regex_pattern_keys=REGEX_PATTERN_KEYS)


@pytest.mark.parametrize(
    ("name", "input", "expected"),
    [
        ("email", """blah test@email.com had a problem""", """blah <email> had a problem"""),
        ("url", """blah http://some.email.com had a problem""", """blah <url> had a problem"""),
        (
            "url - existing behavior",
            """blah tcp://user:pass@email.com:10 had a problem""",
            """blah tcp://user:<email>:<int> had a problem""",
        ),
        ("ip", """blah 0.0.0.0 had a problem""", """blah <ip> had a problem"""),
        (
            "UUID",
            """blah 7c1811ed-e98f-4c9c-a9f9-58c757ff494f had a problem""",
            """blah <uuid> had a problem""",
        ),
        (
            "UUID",
            """blah bea691f2-2e25-4bec-6838-e0c44b03d60a/7c1811ed-e98f-4c9c-a9f9-58c757ff494f had a problem""",
            """blah <uuid>/<uuid> had a problem""",
        ),
        (
            "SHA1",
            """blah 5fc35719b9cf96ec602dbc748ff31c587a46961d had a problem""",
            """blah <sha1> had a problem""",
        ),
        (
            "MD5",
            """blah 0751007cd28df267e8e051b51f918c60 had a problem""",
            """blah <md5> had a problem""",
        ),
        (
            "Date",
            """blah 2024-02-20T22:16:36 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC822",
            """blah Mon, 02 Jan 06 15:04 MST had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC822Z",
            """blah Mon, 02 Jan 06 15:04 -0700 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC850",
            """blah Monday, 02-Jan-06 15:04:05 MST had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC1123",
            """blah Mon, 02 Jan 2006 15:04:05 MST had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC1123Z",
            """blah Mon, 02 Jan 2006 15:04:05 -0700 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC3339",
            """blah 2006-01-02T15:04:05Z07:00 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC3339Nano",
            """blah 2006-01-02T15:04:05.999999999Z07:00 had a problem""",
            """blah <date> had a problem""",
        ),
        ("Date - plain", """blah 2006-01-02 had a problem""", """blah <date> had a problem"""),
        ("Date - long", """blah Jan 18, 2019 had a problem""", """blah <date> had a problem"""),
        (
            "Date - Datetime",
            """blah 2006-01-02 15:04:05 had a problem""",
            """blah <date> had a problem""",
        ),
        ("Date - Kitchen", """blah 3:04PM had a problem""", """blah <date> had a problem"""),
        ("Date - Time", """blah 15:04:05 had a problem""", """blah <date> had a problem"""),
        (
            "Date - basic",
            """blah Mon Jan 02, 1999 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Datetime - compressed",
            """blah 20240220 11:55:33.546593 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Datetime - datestamp",
            """blah 2024-02-23 02:13:53.418 had a problem""",
            """blah <date> had a problem""",
        ),
        ("hex", """blah 0x9af8c3b had a problem""", """blah <hex> had a problem"""),
        ("hex", """blah 9af8c3b0 had a problem""", """blah <hex> had a problem"""),
        ("hex", """blah 9af8c3b09af8c3b0 had a problem""", """blah <hex> had a problem"""),
        (
            "hex - missing numbers",
            """blah aaffccbb had a problem""",
            """blah aaffccbb had a problem""",
        ),
        (
            "hex - not 4 or 8 bytes",
            """blah 4aaa 9aaaaaaaa 10aaaaaaaa 15aaaaaaaaaaaaa 17aaaaaaaaaaaaaaa had a problem""",
            """blah 4aaa 9aaaaaaaa 10aaaaaaaa 15aaaaaaaaaaaaa 17aaaaaaaaaaaaaaa had a problem""",
        ),
        ("float", """blah 0.23 had a problem""", """blah <float> had a problem"""),
        ("int", """blah 23 had a problem""", """blah <int> had a problem"""),
        (
            "traceparent",
            """traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01""",
            """traceparent: <traceparent>""",
        ),
        (
            "int - with separator",
            """blah 0:17502 had a problem""",
            """blah <int>:<int> had a problem""",
        ),
        ("quoted str", """blah b="1" had a problem""", """blah b=<quoted_str> had a problem"""),
        ("bool", """blah a=true had a problem""", """blah a=<bool> had a problem"""),
        (
            "Duration - ms",
            """connection failed after 1ms 23ms 4567890ms""",
            """connection failed after <duration> <duration> <duration>""",
        ),
        (
            "Duration - s",
            """connection failed after 1.234s 56s 78.90s""",
            """connection failed after <duration> <duration> <duration>""",
        ),
        (
            "Hostname - 2 levels",
            """Blocked 'connect' from 'gggggggdasdwefwewqqqfefwef.com'""",
            """Blocked 'connect' from '<hostname>'""",
        ),
        (
            "Hostname - 3 levels",
            """Blocked 'font' from 'www.time.co'""",
            """Blocked 'font' from '<hostname>'""",
        ),
        (
            "Nothing to replace",
            """A quick brown fox jumped over the lazy dog""",
            """A quick brown fox jumped over the lazy dog""",
        ),
    ],
)
def test_parameterize_standard(name, input, expected, parameterizer):
    assert expected == parameterizer.parameterize_all(input), f"Case {name} Failed"


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
        ("URL - IP w/ port", """blah 0.0.0.0:10 had a problem""", """blah <ip> had a problem"""),
        (
            "Int - parens",
            """Tb.Worker {"msg" => "(#239323) Received ...""",
            """Tb.Worker {"msg" => "(#<int>) Received ...""",
        ),
    ],
)
def test_fail_parameterize(name, input, expected, parameterizer):
    assert expected == parameterizer.parameterize_all(input), f"Case {name} Failed"


# These are test cases were we're too aggressive
@pytest.mark.xfail()
@pytest.mark.parametrize(
    ("name", "input", "expected"),
    [
        ("Not an Int", "Encoding: utf-8", "Encoding: utf-8"),  # produces "Encoding: utf<int>"
    ],
)
def test_too_aggressive_parameterize(name, input, expected, parameterizer):
    assert expected == parameterizer.parameterize_all(input), f"Case {name} Failed"
