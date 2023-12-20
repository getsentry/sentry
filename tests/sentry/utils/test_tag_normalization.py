from unittest import mock

import pytest

from sentry.eventstore.models import Event
from sentry.utils.tag_normalization import normalize_sdk_tag, normalized_sdk_tag_from_event


@pytest.mark.parametrize(
    ("tag", "expected"),
    (
        ("sentry-javascript-angular", "sentry.javascript.angular"),
        ("sentry_python", "sentry.python"),
    ),
)
def test_normalizes_to_dots(tag, expected):
    assert normalize_sdk_tag(tag) == expected


@pytest.mark.parametrize(
    ("tag", "expected"),
    (
        ("sentry.javascript.angular", "sentry.javascript.angular"),
        (
            "sentry.javascript.react.native",
            "sentry.javascript.react.native",
        ),
        ("sentry.python.django", "sentry.python"),
        (
            "sentry.native.android.flutter",
            "sentry.native.android",
        ),
    ),
)
def test_shortens_non_js(tag, expected):
    assert normalize_sdk_tag(tag) == expected


@pytest.mark.parametrize(
    ("tag", "expected"),
    (
        ("sentry.javascript.angular", "sentry.javascript.angular"),
        ("sentry.javascript.angular.ivy", "sentry.javascript.angular"),
        ("sentry.symfony", "sentry.php"),
        ("sentry.unity", "sentry.native.unity"),
        ("sentry.javascript.react.native.expo", "sentry.javascript.react.native"),
    ),
)
def test_uses_synonyms(tag, expected):
    assert normalize_sdk_tag(tag) == expected


@pytest.mark.parametrize(
    ("tag", "expected"),
    (("foo.baz.bar", "other"), ("sentryfoo", "other"), ("raven", "other")),
)
def test_non_sentry_to_other(tag, expected):
    assert normalize_sdk_tag(tag) == expected


@pytest.mark.parametrize(
    ("tag", "expected"),
    (("sentry.sparql", "other"), ("sentry.terraform.hcl", "other"), ("sentry-native", "other")),
)
def test_unknown_sentry_to_other(tag, expected):
    assert normalize_sdk_tag(tag) == expected


def test_responses_cached():
    normalize_sdk_tag.cache_clear()
    assert normalize_sdk_tag("sentry.javascript.react") == "sentry.javascript.react"
    assert normalize_sdk_tag("sentry.javascript.react") == "sentry.javascript.react"

    assert normalize_sdk_tag.cache_info().hits == 1
    assert normalize_sdk_tag.cache_info().misses == 1


@pytest.fixture
def mock_event():
    return mock.Mock(spec=Event)


@pytest.mark.parametrize(
    ("tag", "expected"),
    (
        ("sentry.javascript.angular", "sentry.javascript.angular"),
        ("sentry.javascript.angular.ivy", "sentry.javascript.angular"),
        ("sentry.symfony", "sentry.php"),
        ("sentry.unity", "sentry.native.unity"),
        ("sentry.javascript.react.native.expo", "sentry.javascript.react.native"),
    ),
)
def test_normalized_sdk_tag_from_event(tag, expected, mock_event):
    mock_event.data = {"sdk": {"name": tag}}
    assert normalized_sdk_tag_from_event(mock_event) == expected


def test_normalized_sdk_tag_from_event_exception(mock_event):
    mock_event.side_effect = Exception("foo")
    assert normalized_sdk_tag_from_event(mock_event) == "other"
