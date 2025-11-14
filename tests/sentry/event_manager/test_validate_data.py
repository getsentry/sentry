from typing import int
from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.constants import MAX_CULPRIT_LENGTH, MAX_VERSION_LENGTH
from sentry.event_manager import EventManager


def validate_and_normalize(data):
    manager = EventManager(data)
    manager.normalize()
    return manager.get_data()


def test_timestamp() -> None:
    data = validate_and_normalize({"timestamp": "not-a-timestamp"})
    assert len(data["errors"]) == 1

    now = timezone.now()
    data = validate_and_normalize({"timestamp": now.strftime("%Y-%m-%dT%H:%M:%SZ")})
    assert "errors" not in data

    future = now + timedelta(minutes=2)
    data = validate_and_normalize({"timestamp": future.strftime("%Y-%m-%dT%H:%M:%SZ")})
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "future_timestamp"

    past = now - timedelta(days=31)
    data = validate_and_normalize({"timestamp": past.strftime("%Y-%m-%dT%H:%M:%SZ")})
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "past_timestamp"


def test_empty_event_id() -> None:
    data = validate_and_normalize({"event_id": ""})
    assert len(data["event_id"]) == 32


def test_missing_event_id() -> None:
    data = validate_and_normalize({})
    assert len(data["event_id"]) == 32


def test_invalid_event_id() -> None:
    data = validate_and_normalize({"event_id": "a" * 33})
    assert len(data["event_id"]) == 32
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "event_id"
    assert data["errors"][0]["value"] == "a" * 33

    data = validate_and_normalize({"event_id": "xyz"})
    assert len(data["event_id"]) == 32
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "event_id"
    assert data["errors"][0]["value"] == "xyz"


def test_unknown_attribute() -> None:
    data = validate_and_normalize({"message": "foo", "foo": "bar"})
    assert data["foo"] is None
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_attribute"
    assert data["errors"][0]["name"] == "foo"


def test_invalid_interface_name() -> None:
    data = validate_and_normalize({"message": "foo", "foo.baz": "bar"})
    assert data["foo.baz"] is None
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_attribute"
    assert data["errors"][0]["name"] == "foo.baz"


def test_invalid_interface_import_path() -> None:
    data = validate_and_normalize({"message": "foo", "exception2": "bar"})
    assert data["exception2"] is None

    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_attribute"
    assert data["errors"][0]["name"] == "exception2"


def test_does_expand_list() -> None:
    data = validate_and_normalize(
        {
            "message": "foo",
            "exception": [{"type": "ValueError", "value": "hello world", "module": "foo.bar"}],
        }
    )
    assert "exception" in data


def test_log_level_as_string() -> None:
    data = validate_and_normalize({"message": "foo", "level": "error"})
    assert data["level"] == "error"


def test_log_level_as_int() -> None:
    data = validate_and_normalize({"message": "foo", "level": 40})
    assert data["level"] == "error"


def test_invalid_log_level() -> None:
    data = validate_and_normalize({"message": "foo", "level": "foobar"})
    assert data["level"] == "error"
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "level"
    assert data["errors"][0]["value"] == "foobar"


def test_tags_as_string() -> None:
    data = validate_and_normalize({"message": "foo", "tags": "bar"})
    assert data["tags"] == []


def test_tags_with_spaces() -> None:
    data = validate_and_normalize({"message": "foo", "tags": {"foo bar": "baz bar"}})
    assert data["tags"] == [["foo-bar", "baz bar"]]


def test_tags_out_of_bounds() -> None:
    long_key = "f" * 201  # 201 characters
    long_value = "v" * 201  # 201 characters
    data = validate_and_normalize(
        {"message": "foo", "tags": {long_key: "value", "foo": long_value, "bar": "value"}}
    )

    # Tags should be trimmed to 200 characters (197 chars + "..."), not set to None
    # The normalizer trims long strings and adds ellipsis
    trimmed_key = long_key[:197] + "..."  # 197 characters + "..."
    trimmed_value = long_value[:197] + "..."  # 197 characters + "..."

    expected_tags = [["bar", "value"], [trimmed_key, "value"], ["foo", trimmed_value]]
    assert data["tags"] == expected_tags
    assert "errors" not in data or len(data.get("errors", [])) == 0


def test_tags_as_invalid_pair() -> None:
    data = validate_and_normalize(
        {"message": "foo", "tags": [("foo", "bar"), ("biz", "baz", "boz")]}
    )
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "tags.1"
    assert data["errors"][0]["value"] == ["biz", "baz", "boz"]


def test_reserved_tags() -> None:
    data = validate_and_normalize(
        {"message": "foo", "tags": [("foo", "bar"), ("release", "abc123")]}
    )
    assert data["tags"] == [["foo", "bar"]]


def test_tag_value() -> None:
    data = validate_and_normalize({"message": "foo", "tags": [("foo", "b\nar"), ("biz", "baz")]})
    assert data["tags"] == [["foo", None], ["biz", "baz"]]

    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "tags.0.1"
    assert data["errors"][0]["value"] == "b\nar"


def test_extra_as_string() -> None:
    data = validate_and_normalize({"message": "foo", "extra": "bar"})
    assert data["extra"] == {}


def test_release_tag_max_len() -> None:
    release_key = "sentry:release"
    release_value = "a" * MAX_VERSION_LENGTH
    data = validate_and_normalize({"message": "foo", "tags": [[release_key, release_value]]})
    assert "errors" not in data
    assert data["tags"] == [[release_key, release_value]]


def test_server_name_too_long() -> None:
    key = "server_name"
    value = "a" * (MAX_CULPRIT_LENGTH + 1)
    data = validate_and_normalize({key: value})
    assert len(dict(data["tags"])[key]) == MAX_CULPRIT_LENGTH


def test_site_too_long() -> None:
    key = "site"
    value = "a" * (MAX_CULPRIT_LENGTH + 1)
    data = validate_and_normalize({key: value})
    assert len(dict(data["tags"])[key]) == MAX_CULPRIT_LENGTH


def test_release_too_long() -> None:
    data = validate_and_normalize({"release": "a" * (MAX_VERSION_LENGTH + 1)})
    assert not data.get("release")
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "release"
    assert data["errors"][0]["value"] == "a" * (MAX_VERSION_LENGTH + 1)


def test_release_as_non_string() -> None:
    data = validate_and_normalize({"release": 42})
    assert data["release"] == "42"


def test_distribution_too_long() -> None:
    dist_len = 201
    data = validate_and_normalize({"release": "a" * 62, "dist": "b" * dist_len})
    # max dist length since relay-python 0.8.16 = 64 chars, and they started
    # return an error instead of truncating
    assert not data.get("dist")
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "value_too_long"
    assert data["errors"][0]["name"] == "dist"
    assert data["errors"][0]["value"] == "b" * dist_len


def test_distribution_bad_char() -> None:
    data = validate_and_normalize({"release": "a" * 62, "dist": "^%"})
    assert not data.get("dist")
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "dist"
    assert data["errors"][0]["value"] == "^%"


def test_distribution_strip() -> None:
    data = validate_and_normalize({"release": "a" * 62, "dist": " foo "})
    assert data["dist"] == "foo"


def test_distribution_as_non_string() -> None:
    data = validate_and_normalize({"release": "42", "dist": 23})
    assert data["release"] == "42"
    assert data.get("dist") is None


def test_distribution_no_release() -> None:
    data = validate_and_normalize({"dist": 23})
    assert data.get("dist") is None


def test_valid_platform() -> None:
    data = validate_and_normalize({"platform": "python"})
    assert data["platform"] == "python"


def test_no_platform() -> None:
    data = validate_and_normalize({})
    assert data["platform"] == "other"


def test_invalid_platform() -> None:
    data = validate_and_normalize({"platform": "foobar"})
    assert data["platform"] == "other"


def test_environment_too_long() -> None:
    data = validate_and_normalize({"environment": "a" * 65})
    assert not data.get("environment")
    (error,) = data["errors"]
    assert error["type"] == "invalid_data"

    assert error["name"] == "environment"
    assert error["value"] == "a" * 65


def test_environment_invalid() -> None:
    data = validate_and_normalize({"environment": "a/b"})
    assert not data.get("environment")
    (error,) = data["errors"]
    assert error["type"] == "invalid_data"

    assert error["name"] == "environment"
    assert error["value"] == "a/b"


def test_environment_as_non_string() -> None:
    data = validate_and_normalize({"environment": 42})
    assert data.get("environment") is None


def test_time_spent_too_large() -> None:
    data = validate_and_normalize({"time_spent": 2147483647 + 1})
    assert data.get("time_spent") is None


def test_time_spent_invalid() -> None:
    data = validate_and_normalize({"time_spent": "lol"})
    assert not data.get("time_spent")
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "time_spent"
    assert data["errors"][0]["value"] == "lol"


def test_time_spent_non_int() -> None:
    data = validate_and_normalize({"time_spent": "123"})
    assert data["time_spent"] is None


def test_fingerprints() -> None:
    data = validate_and_normalize({"fingerprint": "2012-01-01T10:30:45"})
    assert not data.get("fingerprint")
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "fingerprint"

    data = validate_and_normalize({"fingerprint": ["foo", ["bar"]]})
    assert data["fingerprint"] == ["foo"]
    # With rust, there will be errors emitted

    data = validate_and_normalize({"fingerprint": ["foo", None, "bar"]})
    assert data["fingerprint"] == ["foo", "bar"]
    # With rust, there will be errors emitted

    data = validate_and_normalize({"fingerprint": ["{{default}}", 1, "bar", 4.5, -2.7, True]})
    assert data["fingerprint"] == ["{{default}}", "1", "bar", "4", "-2", "True"]
    assert "errors" not in data

    data = validate_and_normalize({"fingerprint": ["{{default}}", 1e100, -1e100, 1e10]})
    assert data["fingerprint"] == ["{{default}}", "10000000000"]
    assert data["errors"] == [
        {"type": "invalid_data", "name": "fingerprint", "value": [1e100, -1e100]}
    ]

    data = validate_and_normalize({"fingerprint": []})
    assert "fingerprint" not in data
    assert "errors" not in data

    data = validate_and_normalize({"fingerprint": [""]})
    assert data["fingerprint"] == [""]
    assert "errors" not in data


def test_messages() -> None:
    # Just 'message': wrap it in interface
    data = validate_and_normalize({"message": "foo is bar"})
    assert data["logentry"] == {"formatted": "foo is bar"}

    # both 'message' and interface with no 'formatted' value, put 'message'
    # into 'formatted'.
    data = validate_and_normalize(
        {"message": "foo is bar", "logentry": {"message": "something else"}}
    )
    assert data["logentry"] == {"formatted": "something else"}

    # both 'message' and complete interface, 'message' is discarded
    data = validate_and_normalize(
        {
            "message": "foo is bar",
            "logentry": {"message": "something else", "formatted": "something else formatted"},
        }
    )
    assert "errors" not in data
    assert data["logentry"] == {
        "message": "something else",
        "formatted": "something else formatted",
    }


@pytest.mark.skip(reason="Message behavior that didn't make a lot of sense.")
def test_messages_old_behavior() -> None:
    # both 'message' and complete valid interface but interface has the same
    # value for both keys so the 'formatted' value is discarded and ends up
    # being replaced with 'message'
    data = validate_and_normalize(
        {
            "message": "foo is bar",
            "logentry": {"message": "something else", "formatted": "something else"},
        }
    )
    assert "message" not in data
    assert "errors" not in data
    assert data["logentry"] == {"message": "something else", "formatted": "foo is bar"}

    # interface discarded as invalid, replaced by new interface containing
    # wrapped 'message'
    data = validate_and_normalize({"message": "foo is bar", "logentry": {"invalid": "invalid"}})
    assert "message" not in data
    assert len(data["errors"]) == 1
    assert data["logentry"] == {"message": "foo is bar"}
