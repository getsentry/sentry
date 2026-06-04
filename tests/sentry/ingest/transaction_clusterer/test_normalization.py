from unittest import mock

import orjson
import pytest
from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry.ingest.transaction_clusterer.datasource import TRANSACTION_SOURCE_SANITIZED
from sentry.ingest.transaction_clusterer.normalization import normalize_segment_name
from sentry.spans.consumers.process_segments.types import CompatibleSpan, attribute_value
from sentry.testutils.pytest.fixtures import django_db_all


def _segment_span(**kwargs) -> CompatibleSpan:
    segment_span: CompatibleSpan = {
        "organization_id": 1,
        "project_id": 1,
        "trace_id": "94576097f3a64b68b85a59c7d4e3ee2a",
        "span_id": "a49b42af9fb69da0",
        "start_timestamp": 1707953018.865,
        "end_timestamp": 1707953018.972,
        "retention_days": 90,
        "received": 1707953019.044972,
        "status": "ok",
        "exclusive_time": 0.1,
        "op": "default",
        "sentry_tags": {},
        "name": "default",
    }
    segment_span.update(**kwargs)  # type:ignore[call-arg]
    return segment_span


# Ported from Relay:
# https://github.com/getsentry/relay/blob/aad4b6099d12422e88dd5df49abae11247efdd99/relay-event-normalization/src/transactions/processor.rs#L789
@django_db_all
def test_identifiers_scrubbed(default_project: mock.MagicMock):
    segment_span = _segment_span(
        name="/foo/2fd4e1c67a2d28fced849ee1bb76e7391b93eb12/user/123/0",
    )

    normalize_segment_name(default_project, segment_span)

    assert segment_span["name"] == "/foo/*/user/*/0"
    attributes = segment_span.get("attributes") or {}
    assert attributes[ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME] == {
        "type": "string",
        "value": "/foo/*/user/*/0",
    }
    assert attributes[ATTRIBUTE_NAMES.SENTRY_SPAN_SOURCE] == {
        "type": "string",
        "value": "sanitized",
    }
    assert attributes[f"sentry._meta.fields.attributes.{ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME}"] == {
        "type": "string",
        "value": orjson.dumps(
            {"meta": {"": {"rem": [["int", "s", 5, 45], ["int", "s", 51, 54]]}}}
        ).decode(),
    }


@django_db_all
def test_name_attribute_takes_precedence_over_name(default_project: mock.MagicMock):
    segment_span = _segment_span(
        name="/foo/2fd4e1c67a2d28fced849ee1bb76e7391b93eb12/user/123/0",
        attributes={
            ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME: {
                "type": "string",
                "value": "/bar/2fd4e1c67a2d28fced849ee1bb76e7391b93eb12",
            }
        },
    )

    normalize_segment_name(default_project, segment_span)

    assert segment_span["name"] == "/bar/*"
    attributes = segment_span.get("attributes") or {}
    assert attributes[ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME] == {
        "type": "string",
        "value": "/bar/*",
    }
    assert attributes[ATTRIBUTE_NAMES.SENTRY_SPAN_SOURCE] == {
        "type": "string",
        "value": "sanitized",
    }
    assert attributes[f"sentry._meta.fields.attributes.{ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME}"] == {
        "type": "string",
        "value": orjson.dumps({"meta": {"": {"rem": [["int", "s", 5, 45]]}}}).decode(),
    }


@django_db_all
def test_no_meta_changes_if_no_name_changes(default_project: mock.MagicMock):
    segment_span = _segment_span(name="/foo")

    normalize_segment_name(default_project, segment_span)

    assert segment_span["name"] == "/foo"
    attributes = segment_span.get("attributes") or {}
    assert len(attributes) == 0


@django_db_all
@mock.patch(
    "sentry.ingest.transaction_clusterer.normalization.get_sorted_rules_from_redis",
    return_value=[("/users/*/posts/*/**", 0), ("/users/*/**", 0), ("GET /users/*/**", 0)],
)
@pytest.mark.parametrize(
    ("segment_name", "expected", "expected_rule"),
    [
        pytest.param(
            "/users/my-user-name/posts/2022-01-01-that-one-time-i-did-something",
            "/users/*/posts/*",
            "/users/*/posts/*/**",
            id="matches both wildcards",
        ),
        pytest.param(
            "/users/my-user-name/posts/2022-01-01-that-one-time-i-did-something/",
            "/users/*/posts/*/",
            "/users/*/posts/*/**",
            id="matches both wildcards (trailing slash)",
        ),
        pytest.param(
            "/users/my-user-name/posts/2022-01-01-that-one-time-i-did-something/comments",
            "/users/*/posts/*/comments",
            "/users/*/posts/*/**",
            id="matches both wildcards with suffix",
        ),
        pytest.param(
            "/users/my-user-name/posts/2022-01-01-that-one-time-i-did-something/comments/",
            "/users/*/posts/*/comments/",
            "/users/*/posts/*/**",
            id="matches both wildcards with suffix (trailing slash)",
        ),
        pytest.param(
            "/users/my-user-name/settings",
            "/users/*/settings",
            "/users/*/**",
            id="matches first wildcards with suffix",
        ),
        pytest.param(
            "/users/my-user-name/settings/",
            "/users/*/settings/",
            "/users/*/**",
            id="matches first wildcards with suffix (trailing slash)",
        ),
        pytest.param(
            "/users/my-user-name",
            "/users/*",
            "/users/*/**",
            id="matches first wildcard",
        ),
        pytest.param(
            "/users/my-user-name/",
            "/users/*/",
            "/users/*/**",
            id="matches first wildcard (trailing slash)",
        ),
        pytest.param(
            "/users",
            "/users",
            None,
            id="ends before first wildcard",
        ),
        pytest.param(
            "/users/",
            "/users/",
            None,
            id="ends before first wildcard (trailing slash)",
        ),
        pytest.param(
            "/user",
            "/user",
            None,
            id="matching text prefix",
        ),
        pytest.param(
            "/user/",
            "/user/",
            None,
            id="matching text prefix (trailing slash)",
        ),
        pytest.param(
            "/foo",
            "/foo",
            None,
            id="unrelated text prefix",
        ),
        pytest.param(
            "/foo/",
            "/foo/",
            None,
            id="unrelated text prefix (trailing slash)",
        ),
        pytest.param(
            "GET /users/my-user-name",
            "GET /users/*",
            "GET /users/*/**",
            id="method prefix: matches wildcard",
        ),
        pytest.param(
            "GET /users/my-user-name/",
            "GET /users/*/",
            "GET /users/*/**",
            id="method prefix: matches wildcard (trailing slash)",
        ),
        pytest.param(
            "GET /users",
            "GET /users",
            None,
            id="method prefix: ends before wildcard",
        ),
        pytest.param(
            "GET /users/",
            "GET /users/",
            None,
            id="method prefix: ends before wildcard (trailing slash)",
        ),
    ],
)
def test_clusterer_applies_rules(
    _mock_get_sorted_rules: mock.MagicMock,
    segment_name: str,
    expected: str,
    expected_rule: str | None,
    default_project: mock.MagicMock,
):
    segment_span = _segment_span(name=segment_name)

    normalize_segment_name(default_project, segment_span)

    assert segment_span["name"] == expected
    if segment_name != expected:
        assert attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME) == expected
        assert (
            attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_SPAN_SOURCE)
            == TRANSACTION_SOURCE_SANITIZED
        )
        assert (
            attribute_value(
                segment_span,
                f"sentry._meta.fields.attributes.{ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME}",
            )
            == orjson.dumps(
                {"meta": {"": {"val": segment_name, "rem": [[expected_rule, "s"]]}}}
            ).decode()
        )


@django_db_all
@mock.patch(
    "sentry.ingest.transaction_clusterer.normalization.get_sorted_rules_from_redis",
    return_value=[("/users/*/**", 0)],
)
def test_clusterer_works_with_scrubbing(
    _mock_get_sorted_rules: mock.MagicMock,
    default_project: mock.MagicMock,
):
    segment_name = "/users/my-user-name/94576097f3a64b68b85a59c7d4e3ee2a"
    segment_span = _segment_span(name=segment_name)

    normalize_segment_name(default_project, segment_span)

    expected = "/users/*/*"
    assert segment_span["name"] == expected
    assert attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME) == expected
    assert (
        attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_SPAN_SOURCE)
        == TRANSACTION_SOURCE_SANITIZED
    )
    assert (
        attribute_value(
            segment_span,
            f"sentry._meta.fields.attributes.{ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME}",
        )
        == orjson.dumps(
            {"meta": {"": {"val": segment_name, "rem": [["/users/*/**", "s"]]}}}
        ).decode()
    )
