from unittest.mock import patch

import pytest

from sentry.grouping.api import _get_variants_from_strategies
from sentry.grouping.component import (
    ChainedExceptionGroupingComponent,
    ErrorValueGroupingComponent,
    ExceptionGroupingComponent,
    MessageGroupingComponent,
)
from sentry.grouping.context import GroupingContext
from sentry.grouping.parameterization import (
    experimental_parameterizer,
    parameterizer,
)
from sentry.grouping.variants import ComponentVariant, CustomFingerprintVariant
from sentry.models.project import Project
from sentry.services.eventstore.models import Event
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.pytest.mocking import count_matching_calls

standard_cases = [
    ("email", "test@email.com", "<email>"),
    ("url", "http://some.email.com", "<url>"),
    ("url - existing behavior", "tcp://user:pass@email.com:10", "tcp://user:<email>:<int>"),
    ("hostname - tld", "example.com", "<hostname>"),
    ("hostname - subdomain", "www.example.net", "<hostname>"),
    ("ip", "0.0.0.0", "<ip>"),
    ("ip - double colon object property", "Option::unwrap()", "Option::unwrap()"),
    ("ip - double colon object property including hex", "Bee::buzz()", "Bee::buzz()"),
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
    ("date - datetime space-separated", "2006-01-02 15:04:05", "<date>"),
    ("date - datetime space-separated UTC", "2006-01-02 15:04:05Z", "<date>"),
    ("date - datetime space-separated w offset", "2006-01-02 15:04:05+01:00", "<date>"),
    ("date - datetime T-separated", "2006-01-02T15:04:05", "<date>"),
    ("date - datetime T-separated UTC", "2006-01-02T15:04:05Z", "<date>"),
    ("date - datetime T-separated w offset", "2006-01-02T15:04:05+01:00", "<date>"),
    ("date - datetime compressed space-separated", "20060102 150405", "<date>"),
    ("date - datetime compressed space-separated UTC", "20060102 150405Z", "<date>"),
    ("date - datetime compressed space-separated w offset", "20060102 150405+0100", "<date>"),
    ("date - datetime compressed T-separated", "20060102T150405", "<date>"),
    ("date - datetime compressed T-separated UTC", "20060102T150405Z", "<date>"),
    ("date - datetime compressed T-separated w offset", "20060102T150405+0100", "<date>"),
    ("date - kitchen uppercase without space", "11:21PM", "<date>"),
    ("date - kitchen uppercase with space", "12:31 PM", "<date>"),
    ("date - kitchen lowercase without space", "11:21pm", "<date>"),
    ("date - kitchen lowercase with space", "12:31 pm", "<date>"),
    ("date - kitchen 24-hour", "23:21", "<date>"),
    ("date - time", "15:04:05", "<date>"),
    ("date - basic", "Mon Jan 02, 1999", "<date>"),
    ("date - datetime compressed date", "20240220 11:55:33.546593", "<date>"),
    ("date - datestamp", "2024-02-23 02:13:53.418", "<date>"),
    ("date - datetime object", "datetime.datetime(2025, 6, 24, 18, 33, 0, 447640)", "<date>"),
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
    ("swift_txn_id - missing prefix", "ab274a77a8975c4a66aeb24-0052d95365", "<hex>-<hex>"),
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
    ("hex without prefix - lowercase, 10 digits", "9af8c3be3a", "<hex>"),
    ("hex without prefix - uppercase, 10 digits", "9AF8C3BE3A", "<hex>"),
    ("hex without prefix - lowercase, 16 digits", "9af8c3be3a1231fe", "<hex>"),
    ("hex without prefix - uppercase, 16 digits", "9AF8C3BE3A1231FE", "<hex>"),
    ("hex without prefix - lowercase, 24 digits", "9af8c3be3a1231fe1121acb1", "<hex>"),
    ("hex without prefix - uppercase, 24 digits", "9AF8C3BE3A1231FE1121ACB1", "<hex>"),
    ("hex without prefix - lowercase, 128 digits", "b0" * 64, "<hex>"),
    ("hex without prefix - uppercase, 128 digits", "B0" * 64, "<hex>"),
    ("hex without prefix - lowercase, no numbers", "deadbeef", "deadbeef"),
    ("hex without prefix - uppercase, no numbers", "DEADBEEF", "DEADBEEF"),
    ("hex without prefix - lowercase, no numbers until later", "deadbeef 123", "deadbeef <int>"),
    ("hex without prefix - uppercase, no numbers until later", "DEADBEEF 123", "DEADBEEF <int>"),
    ("hex without prefix - no letters, < 8 digits", "1234567", "<int>"),
    ("hex without prefix - no letters, 8+ digits", "12345678", "<hex>"),
    ("git sha", "commit a93c7d2", "commit <git_sha>"),
    ("git sha - all letters", "commit deadbeef", "commit deadbeef"),
    ("git sha - all numbers", "commit 4150908", "commit <int>"),
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
def test_default_parameterization(name: str, input: str, expected: str) -> None:
    assert parameterizer.parameterize(input) == expected
    assert parameterizer.parameterize(f"prefix {input}") == f"prefix {expected}"
    assert parameterizer.parameterize(f"{input} suffix") == f"{expected} suffix"
    assert parameterizer.parameterize(f"prefix {input} suffix") == f"prefix {expected} suffix"


@pytest.mark.parametrize(("name", "input", "expected"), experimental_cases)
def test_default_parameterizer_misses_experimental_cases(
    name: str, input: str, expected: str
) -> None:
    assert parameterizer.parameterize(input) != expected
    assert parameterizer.parameterize(f"prefix {input}") != f"prefix {expected}"
    assert parameterizer.parameterize(f"{input} suffix") != f"{expected} suffix"
    assert parameterizer.parameterize(f"prefix {input} suffix") != f"prefix {expected} suffix"


@pytest.mark.skipif(
    not experimental_parameterizer._experimental, reason="no experimental regexes to test"
)
@pytest.mark.parametrize(("name", "input", "expected"), standard_cases + experimental_cases)
def test_experimental_parameterization(name: str, input: str, expected: str) -> None:
    assert experimental_parameterizer.parameterize(input) == expected
    assert experimental_parameterizer.parameterize(f"prefix {input}") == f"prefix {expected}"
    assert experimental_parameterizer.parameterize(f"{input} suffix") == f"{expected} suffix"
    assert (
        experimental_parameterizer.parameterize(f"prefix {input} suffix")
        == f"prefix {expected} suffix"
    )


# Known problems, which we should fix if we can (might not always be possible). Includes false
# positives (cases where we parameterize too aggressively), false negatives (cases where miss
# parameterizing something), and otherwise incorrect parameterizations.
#
# TODO: Move as many of these as possible up to `standard_cases` above by improving
# parameterization. (Remember to remove the last item in each tuple for the cases you fix.)
incorrect_cases = [
    # ("name", "input", "desired", "actual")
    (
        "int - number in word",
        "Encoding: utf-8",
        "Encoding: utf-8",
        "Encoding: utf<int>",
    ),
    (
        "int - with commas",
        "4,150,908",
        "<int>",
        "<int>,<int>,<int>",
    ),
    (
        "json - double quotes",
        '{"dogs are great": true, "dog_id": "greatdog1231"}',
        '{"dogs are great": <bool>, "dog_id": <id>}',
        '{"dogs are great": true, "dog_id": "greatdog1231"}',
    ),
    # Single quotes make this not valid JSON, but when the JSON is stringified, sometimes it comes
    # out that way
    (
        "json - single quotes",
        "{'dogs are great': true, 'dog_id': 'greatdog1231'}",
        "{'dogs are great': <bool>, 'dog_id': '<id>'}",
        "{'dogs are great': true, 'dog_id': 'greatdog1231'}",
    ),
    (
        "random sequence as id",
        "invoice k9Mtd2gDcgG",
        "invoice <random_str>",
        "invoice k9Mtd2gDcgG",
    ),
    (
        "URL - non-http protocol user/pass/port",
        "tcp://user:pass@email.com:10 had a problem",
        "<url> had a problem",
        "tcp://user:<email>:<int> had a problem",
    ),
]


@pytest.mark.parametrize(("name", "input", "desired", "actual"), incorrect_cases)
def test_incorrect_parameterization(name: str, input: str, desired: str, actual: str) -> None:
    assert parameterizer.parameterize(input) != desired
    assert parameterizer.parameterize(input) == actual


@django_db_all
def test_parameterized_message_stored_on_context(default_project: Project) -> None:
    with patch(
        "sentry.grouping.api._get_variants_from_strategies", wraps=_get_variants_from_strategies
    ) as mock_get_variants:
        event = Event(default_project.id, "11211231", data={"message": "Dog number 1, #1 dog"})
        event.get_grouping_variants()

        context = mock_get_variants.call_args.args[1]

        assert isinstance(context, GroupingContext)
        assert len(context.message_parameterization_map) == 1
        assert (
            context.message_parameterization_map["Dog number 1, #1 dog"]
            == "Dog number <int>, #<int> dog"
        )


@django_db_all
def test_parameterized_error_message_stored_on_context(default_project: Project) -> None:
    with patch(
        "sentry.grouping.api._get_variants_from_strategies", wraps=_get_variants_from_strategies
    ) as mock_get_variants:
        event = Event(
            default_project.id,
            "11211231",
            data={
                "exception": {
                    "values": [
                        {
                            "type": "FailedToFetchError",
                            "value": "That's ball number 6 that Charlie hasn't brought back!",
                        }
                    ]
                },
            },
        )
        event.get_grouping_variants()

        context = mock_get_variants.call_args.args[1]

        assert isinstance(context, GroupingContext)
        assert len(context.message_parameterization_map) == 1
        assert (
            context.message_parameterization_map[
                "That's ball number 6 that Charlie hasn't brought back!"
            ]
            == "That's ball number <int> that Charlie hasn't brought back!"
        )


@django_db_all
def test_parameterized_chained_error_messages_stored_on_context(default_project: Project) -> None:
    with patch(
        "sentry.grouping.api._get_variants_from_strategies", wraps=_get_variants_from_strategies
    ) as mock_get_variants:
        event = Event(
            default_project.id,
            "11211231",
            data={
                "exception": {
                    "values": [
                        {
                            "type": "DogSourcingError",
                            "value": "Adopt don't shop!",
                        },
                        {
                            "type": "FailedToFetchError",
                            "value": "That's ball number 6 that Charlie hasn't brought back!",
                        },
                        {
                            "type": "DestroyedShoeError",
                            "value": "Oh, no! Maisey ate Dad's slippers!",
                        },
                    ]
                },
            },
        )
        event.get_grouping_variants()

        context = mock_get_variants.call_args.args[1]

        assert isinstance(context, GroupingContext)
        assert len(context.message_parameterization_map) == 3
        assert context.message_parameterization_map["Adopt don't shop!"] == "Adopt don't shop!"
        assert (
            context.message_parameterization_map[
                "That's ball number 6 that Charlie hasn't brought back!"
            ]
            == "That's ball number <int> that Charlie hasn't brought back!"
        )
        assert (
            context.message_parameterization_map["Oh, no! Maisey ate Dad's slippers!"]
            == "Oh, no! Maisey ate Dad's slippers!"
        )


@django_db_all
def test_stored_parameterized_message_used(default_project: Project) -> None:
    with (
        patch("sentry.grouping.utils.metrics.incr") as mock_metrics_incr,
        patch(
            "sentry.grouping.parameterization.parameterizer.parameterize",
            wraps=parameterizer.parameterize,
        ) as parameterize_spy,
    ):
        event = Event(
            default_project.id,
            "11211231",
            data={
                "message": "Dog number 1, #1 dog",
                "fingerprint": ["{{ message }}"],
            },
        )
        variants = event.get_grouping_variants()

        assert len(variants) == 2
        message_variant = variants["default"]
        fingerprint_variant = variants["custom_client_fingerprint"]

        assert isinstance(message_variant, ComponentVariant)
        assert isinstance(message_variant.contributing_component, MessageGroupingComponent)
        assert message_variant.contributing_component.values == ["Dog number <int>, #<int> dog"]

        assert isinstance(fingerprint_variant, CustomFingerprintVariant)
        assert fingerprint_variant.values == ["Dog number <int>, #<int> dog"]

        # Even though the parameterized message was used in two places, the parameterizer only ran
        # once, meaning the stored value must have been used
        assert parameterize_spy.call_count == 1
        assert count_matching_calls(mock_metrics_incr, "grouping.cached_param_result_used") == 1


@django_db_all
def test_runs_parameterizer_on_fingerprint_constant_matching_message(
    default_project: Project,
) -> None:
    event = Event(
        default_project.id,
        "11211231",
        data={
            "message": "Dog number 1, #1 dog",
            "fingerprint": ["Dog number 1, #1 dog", "Dogs are great!"],
        },
    )
    variants = event.get_grouping_variants()

    assert len(variants) == 2

    message_variant = variants["default"]
    assert isinstance(message_variant, ComponentVariant)

    message_component = message_variant.contributing_component
    assert isinstance(message_component, MessageGroupingComponent)

    fingerprint_variant = variants["custom_client_fingerprint"]
    assert isinstance(fingerprint_variant, CustomFingerprintVariant)

    # Both instances of the message have been parameterized
    assert message_component.values == ["Dog number <int>, #<int> dog"]
    assert fingerprint_variant.values == [
        # Parameterized because it matches the event's message
        "Dog number <int>, #<int> dog",
        "Dogs are great!",
    ]


@django_db_all
def test_runs_parameterizer_on_fingerprint_constant_matching_error_message(
    default_project: Project,
) -> None:
    event = Event(
        default_project.id,
        "11211231",
        data={
            "exception": {
                "values": [
                    {
                        "type": "FailedToFetchError",
                        "value": "That's ball number 6 that Charlie hasn't brought back!",
                    }
                ]
            },
            "fingerprint": [
                "That's ball number 6 that Charlie hasn't brought back!",
                "Dogs are great!",
            ],
        },
    )
    variants = event.get_grouping_variants()

    assert len(variants) == 2

    app_variant = variants["app"]
    assert isinstance(app_variant, ComponentVariant)

    exception_component = app_variant.contributing_component
    assert isinstance(exception_component, ExceptionGroupingComponent)

    error_message_component = exception_component.values[1]
    assert isinstance(error_message_component, ErrorValueGroupingComponent)

    fingerprint_variant = variants["custom_client_fingerprint"]
    assert isinstance(fingerprint_variant, CustomFingerprintVariant)

    # Both instances of the message have been parameterized
    assert error_message_component.values == [
        "That's ball number <int> that Charlie hasn't brought back!"
    ]
    assert fingerprint_variant.values == [
        # Parameterized because it matches the event's error message
        "That's ball number <int> that Charlie hasn't brought back!",
        "Dogs are great!",
    ]


@django_db_all
def test_runs_parameterizer_on_fingerprint_constant_matching_chained_error_message(
    default_project: Project,
) -> None:
    event = Event(
        default_project.id,
        "11211231",
        data={
            "exception": {
                "values": [
                    {
                        "type": "DogSourcingError",
                        "value": "Adopt don't shop!",
                    },
                    {
                        "type": "FailedToFetchError",
                        "value": "That's ball number 6 that Charlie hasn't brought back!",
                    },
                    {
                        "type": "DestroyedShoeError",
                        "value": "Oh, no! Maisey ate Dad's slippers!",
                    },
                ]
            },
            "fingerprint": [
                "That's ball number 6 that Charlie hasn't brought back!",
                "Dogs are great!",
            ],
        },
    )
    variants = event.get_grouping_variants()

    assert len(variants) == 2

    app_variant = variants["app"]
    assert isinstance(app_variant, ComponentVariant)

    chained_exception_component = app_variant.contributing_component
    assert isinstance(chained_exception_component, ChainedExceptionGroupingComponent)

    middle_exception_component = chained_exception_component.values[1]
    assert isinstance(middle_exception_component, ExceptionGroupingComponent)

    middle_error_message_component = middle_exception_component.values[1]
    assert isinstance(middle_error_message_component, ErrorValueGroupingComponent)

    fingerprint_variant = variants["custom_client_fingerprint"]
    assert isinstance(fingerprint_variant, CustomFingerprintVariant)

    # Both instances of the message have been parameterized
    assert middle_error_message_component.values == [
        "That's ball number <int> that Charlie hasn't brought back!"
    ]
    assert fingerprint_variant.values == [
        # Parameterized because it matches one of the error messages in the chain
        "That's ball number <int> that Charlie hasn't brought back!",
        "Dogs are great!",
    ]
