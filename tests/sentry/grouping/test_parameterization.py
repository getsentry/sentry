from unittest import mock

import pytest

from sentry.grouping.parameterization import (
    ParameterizationRegexExperiment,
    Parameterizer,
    UniqueIdExperiment,
)


@pytest.fixture
def parameterizer():
    return Parameterizer(
        regex_pattern_keys=(
            "email",
            "url",
            "hostname",
            "ip",
            "uuid",
            "sha1",
            "md5",
            "date",
            "duration",
            "hex",
            "float",
            "int",
            "quoted_str",
            "bool",
        ),
        experiments=(UniqueIdExperiment,),
    )


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
        ("float", """blah 0.23 had a problem""", """blah <float> had a problem"""),
        ("int", """blah 23 had a problem""", """blah <int> had a problem"""),
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


@pytest.mark.parametrize(
    ("name", "input", "expected"),
    [
        (
            "Uniq ID - sql savepoint",
            '''SQL: RELEASE SAVEPOINT "s140177518376768_x2"''',
            """SQL: RELEASE SAVEPOINT <uniq_id>""",
        ),
        (
            "Uniq ID - api gateway",
            """API gateway VdLchF7iDo8sVkg= blah""",
            """API gateway <uniq_id> blah""",
        ),
        (
            "Uniq ID - fb trace",
            """fbtrace_id Aba64NMEPMmBwi_cPLaGeeK AugPfq0jxGbto4u3kxn8u6p blah""",
            """fbtrace_id <uniq_id> <uniq_id> blah""",
        ),
        (
            "Uniq ID - word with numerical pre/suffix",
            """1password python3 abc123 123abc""",
            """1password python3 abc123 123abc""",
        ),
        (
            "Uniq ID - cloudflare trace",
            """cloudflare trace 230b030023ae2822-SJC 819cc532aex26akb-SNP blah""",
            """cloudflare trace <uniq_id> <uniq_id> blah""",
        ),
        (
            "Uniq ID - JWT",
            """blah eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c""",
            """blah <uniq_id>""",
        ),
        (
            "Uniq ID - Nothing to replace",
            """I am the test words 1password python3 abc123 123abc""",
            """I am the test words 1password python3 abc123 123abc""",
        ),
        (
            "Uniq ID - react element",
            """Permission denied to access property "__reactFiber$b6c78e70asw" """,
            """Permission denied to access property <uniq_id> """,
        ),
        (
            "Uniq ID - no change variable name",
            """TypeError: Cannot read property 'startRTM' of undefined""",
            """TypeError: Cannot read property 'startRTM' of undefined""",
        ),
        (
            "Uniq ID - json ignored properly",
            """[401,""]""",
            """[<int>,""]""",
        ),
        (
            "Uniq ID - no change",
            """Blocked 'script' from 'wasm-eval:'""",
            """Blocked 'script' from 'wasm-eval:'""",
        ),
    ],
)
def test_parameterize_experiment(name, input, expected, parameterizer):
    assert expected == parameterizer.parameterize_all(input), f"Case {name} Failed"
    if "<uniq_id>" in expected:
        experiments = parameterizer.get_successful_experiments()
        assert len(experiments) == 1
        assert experiments[0] == UniqueIdExperiment


def test_parameterize_regex_experiment():
    """
    We don't have any of these yet, but we need to test that they work
    """
    FooExperiment = ParameterizationRegexExperiment(name="foo", raw_pattern=r"f[oO]{2}")

    parameterizer = Parameterizer(
        regex_pattern_keys=(),
        experiments=(FooExperiment,),
    )
    input_str = "blah foobarbaz fooooo"
    normalized = parameterizer.parameterize_all(input_str)
    assert normalized == "blah <foo>barbaz <foo>ooo"
    assert len(parameterizer.get_successful_experiments()) == 1
    assert parameterizer.get_successful_experiments()[0] == FooExperiment


def test_parameterize_regex_experiment_cached_compiled():

    with mock.patch.object(
        ParameterizationRegexExperiment,
        "pattern",
        new_callable=mock.PropertyMock,
        return_value=r"(?P<foo>f[oO]{2})",
    ) as mocked_pattern:
        FooExperiment = ParameterizationRegexExperiment(name="foo", raw_pattern=r"f[oO]{2}")
        parameterizer = Parameterizer(
            regex_pattern_keys=(),
            experiments=(FooExperiment,),
        )
        input_str = "blah foobarbaz fooooo"
        _ = parameterizer.parameterize_all(input_str)
        _ = parameterizer.parameterize_all(input_str)

    mocked_pattern.assert_called_once()


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
        (
            "Uniq ID - Snuba query",
            """Error running query: SELECT (divide(plus(sumMergeIf((value AS _snuba_value), equals((arrayElement(tags.raw_value, indexOf(tags.key, 9223372036854776026)) AS `_snuba_tags_raw[9223372036854776026]`), 'satisfactory') AND equals((metric_id AS _snuba_metric_id), 9223372036854775936)), divide(sumMergeIf(_snuba_value, equals(`_snuba_tags_raw[9223372036854776026]`, 'tolerable') AND equals(_snuba_metric_id, 9223372036854775936)), 2)), sumMergeIf(_snuba_value, equals(_snuba_metric_id, 9223372036854775936))) AS `_snuba_c:transactions/on_demand@none`) FROM generic_metric_counters_aggregated_dist WHERE equals(granularity, 1) AND equals((org_id AS _snuba_org_id), 1383997) AND in((project_id AS _snuba_project_id), [6726638]) AND greaterOrEquals((timestamp AS _snuba_timestamp), toDateTime('2024-03-18T22:52:00', 'Universal')) AND less(_snuba_timestamp, toDateTime('2024-03-18T23:22:00', 'Universal')) AND equals((arrayElement(tags.raw_value, indexOf(tags.key, 9223372036854776069)) AS `_snuba_tags_raw[9223372036854776069]`), '2d896d92') AND in(_s...}""",
            """Error running query: SELECT (divide(plus(sumMergeIf((value AS _snuba_value), equals((arrayElement(tags.raw_value, indexOf(tags.key, <int>)) AS `_snuba_tags_raw[<int>]`), 'satisfactory') AND equals((metric_id AS _snuba_metric_id), <int>)), divide(sumMergeIf(_snuba_value, equals(`_snuba_tags_raw[<int>]`, 'tolerable') AND equals(_snuba_metric_id, <int>)), 2)), sumMergeIf(_snuba_value, equals(_snuba_metric_id, <int>))) AS `_snuba_c:transactions/on_demand@none`) FROM generic_metric_counters_aggregated_dist WHERE equals(granularity, 1) AND equals((org_id AS _snuba_org_id), <int>) AND in((project_id AS _snuba_project_id), [<int>]) AND greaterOrEquals((timestamp AS _snuba_timestamp), toDateTime('2024-03-18T22:52:00', 'Universal')) AND less(_snuba_timestamp, toDateTime('<date>', 'Universal')) AND equals((arrayElement(tags.raw_value, indexOf(tags.key, <int>)) AS `_snuba_tags_raw[<int>]`), '<uniq_id>') AND in(_s...}""",
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
        ("Not a Uniq ID", "X-Amz-Apigw-Id", "X-Amz-Apigw-Id"),  # produces "<uniq_id>"
    ],
)
def test_too_aggressive_parameterize(name, input, expected, parameterizer):
    assert expected == parameterizer.parameterize_all(input), f"Case {name} Failed"
