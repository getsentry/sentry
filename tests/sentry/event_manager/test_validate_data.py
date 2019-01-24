from __future__ import absolute_import

import pytest

from datetime import datetime, timedelta

from sentry.constants import VERSION_LENGTH, MAX_CULPRIT_LENGTH
from sentry.event_manager import EventManager, ENABLE_RUST


def validate_and_normalize(data):
    manager = EventManager(data)
    manager.normalize()
    return manager.get_data()


def test_timestamp():
    data = validate_and_normalize({"timestamp": "not-a-timestamp"})
    assert len(data["errors"]) == 1

    now = datetime.utcnow()
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


def test_empty_event_id():
    data = validate_and_normalize({"event_id": ""})
    assert len(data["event_id"]) == 32


def test_missing_event_id():
    data = validate_and_normalize({})
    assert len(data["event_id"]) == 32


def test_invalid_event_id():
    data = validate_and_normalize({"event_id": "a" * 33})
    assert len(data["event_id"]) == 32
    assert len(data["errors"]) == 1
    if ENABLE_RUST:
        assert data["errors"][0]["type"] == "invalid_data"
    else:
        assert data["errors"][0]["type"] == "value_too_long"
    assert data["errors"][0]["name"] == "event_id"
    assert data["errors"][0]["value"] == "a" * 33

    data = validate_and_normalize({"event_id": "xyz"})
    assert len(data["event_id"]) == 32
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "event_id"
    assert data["errors"][0]["value"] == "xyz"


def test_unknown_attribute():
    data = validate_and_normalize({"message": "foo", "foo": "bar"})
    if ENABLE_RUST:
        assert data['foo'] is None
    else:
        assert "foo" not in data
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_attribute"
    assert data["errors"][0]["name"] == "foo"


def test_invalid_interface_name():
    data = validate_and_normalize({"message": "foo", "foo.baz": "bar"})
    if ENABLE_RUST:
        assert data["foo.baz"] is None
    else:
        assert "foo.baz" not in data
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_attribute"
    assert data["errors"][0]["name"] == "foo.baz"


def test_invalid_interface_import_path():
    data = validate_and_normalize(
        {"message": "foo", "exception2": "bar"}
    )
    if ENABLE_RUST:
        assert data['exception2'] is None
    else:
        assert "exception2" not in data

    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_attribute"
    assert data["errors"][0]["name"] == "exception2"


def test_does_expand_list():
    data = validate_and_normalize(
        {
            "message": "foo",
            "exception": [
                {"type": "ValueError", "value": "hello world", "module": "foo.bar"}
            ],
        }
    )
    assert "exception" in data


def test_log_level_as_string():
    data = validate_and_normalize({"message": "foo", "level": "error"})
    assert data["level"] == "error"


def test_log_level_as_int():
    data = validate_and_normalize({"message": "foo", "level": 40})
    assert data["level"] == "error"


def test_invalid_log_level():
    data = validate_and_normalize({"message": "foo", "level": "foobar"})
    assert data["level"] == "error"
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "level"
    assert data["errors"][0]["value"] == "foobar"


def test_tags_as_string():
    data = validate_and_normalize({"message": "foo", "tags": "bar"})
    if ENABLE_RUST:
        assert data['tags'] == []
    else:
        assert "tags" not in data


def test_tags_with_spaces():
    data = validate_and_normalize({"message": "foo", "tags": {"foo bar": "baz bar"}})
    if ENABLE_RUST:
        assert data["tags"] == [["foo-bar", "baz bar"]]
    else:
        assert data["tags"] == [("foo-bar", "baz bar")]


def test_tags_out_of_bounds():
    data = validate_and_normalize(
        {
            "message": "foo",
            "tags": {"f" * 33: "value", "foo": "v" * 201, "bar": "value"},
        }
    )
    if ENABLE_RUST:
        assert data["tags"] == [["bar", "value"], None, None]
    else:
        assert data["tags"] == [("bar", "value")]
    assert len(data["errors"]) == 2


def test_tags_as_invalid_pair():
    data = validate_and_normalize(
        {"message": "foo", "tags": [("foo", "bar"), ("biz", "baz", "boz")]}
    )
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    if ENABLE_RUST:
        assert data["errors"][0]["name"] == "tags.1"
        assert data["errors"][0]["value"] == ["biz", "baz", "boz"]
    else:
        assert data["errors"][0]["name"] == "tags"
        assert data["errors"][0]["value"] == [("foo", "bar"), ("biz", "baz", "boz")]


def test_reserved_tags():
    data = validate_and_normalize(
        {"message": "foo", "tags": [("foo", "bar"), ("release", "abc123")]}
    )
    if ENABLE_RUST:
        assert data["tags"] == [["foo", "bar"]]
    else:
        assert data["tags"] == [("foo", "bar")]

        assert len(data["errors"]) == 1
        assert data["errors"][0]["type"] == "invalid_data"
        assert data["errors"][0]["name"] == "tags.0"
        assert data["errors"][0]["value"] == ("release", "abc123")


def test_tag_value():
    data = validate_and_normalize(
        {"message": "foo", "tags": [("foo", "b\nar"), ("biz", "baz")]}
    )
    if ENABLE_RUST:
        assert data["tags"] == [["foo", None], ["biz", "baz"]]
    else:
        assert data["tags"] == [("biz", "baz")]

    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    if ENABLE_RUST:
        assert data["errors"][0]["name"] == "tags.0.1"
        assert data["errors"][0]["value"] == "b\nar"
    else:
        assert data["errors"][0]["name"] == "tags.0"
        assert data["errors"][0]["value"] == ("foo", "b\nar")


def test_extra_as_string():
    data = validate_and_normalize({"message": "foo", "extra": "bar"})
    if ENABLE_RUST:
        assert data['extra'] == {}
    else:
        assert 'extra' not in data


def test_release_tag_max_len():
    release_key = u"sentry:release"
    release_value = "a" * VERSION_LENGTH
    data = validate_and_normalize(
        {"message": "foo", "tags": [[release_key, release_value]]}
    )
    assert "errors" not in data
    if ENABLE_RUST:
        assert data["tags"] == [[release_key, release_value]]
    else:
        assert data["tags"] == [(release_key, release_value)]


def test_server_name_too_long():
    key = u"server_name"
    value = "a" * (MAX_CULPRIT_LENGTH + 1)
    data = validate_and_normalize({key: value})
    if ENABLE_RUST:
        assert len(dict(data['tags']).get(key)) == MAX_CULPRIT_LENGTH
    else:
        assert not data.get(key)
        assert not dict(data.get('tags') or ()).get(key)
        assert len(data["errors"]) == 1
        assert data["errors"][0]["type"] == "value_too_long"
        assert data["errors"][0]["name"] == key
        assert data["errors"][0]["value"] == value


def test_site_too_long():
    key = u"site"
    value = "a" * (MAX_CULPRIT_LENGTH + 1)
    data = validate_and_normalize({key: value})
    if ENABLE_RUST:
        assert len(dict(data['tags']).get(key)) == MAX_CULPRIT_LENGTH
    else:
        assert not data.get(key)
        assert not dict(data.get('tags') or ()).get(key)
        assert len(data["errors"]) == 1
        assert data["errors"][0]["type"] == "value_too_long"
        assert data["errors"][0]["name"] == key
        assert data["errors"][0]["value"] == value


def test_release_too_long():
    data = validate_and_normalize({"release": "a" * (VERSION_LENGTH + 1)})
    if ENABLE_RUST:
        assert len(data.get("release")) == VERSION_LENGTH
    else:
        assert not data.get("release")
        assert len(data["errors"]) == 1
        assert data["errors"][0]["type"] == "value_too_long"
        assert data["errors"][0]["name"] == "release"
        assert data["errors"][0]["value"] == "a" * (VERSION_LENGTH + 1)


def test_release_as_non_string():
    data = validate_and_normalize({"release": 42})
    assert data.get("release") == "42"


def test_distribution_too_long():
    if ENABLE_RUST:
        dist_len = 201
    else:
        dist_len = 65
    data = validate_and_normalize({"release": "a" * 62, "dist": "b" * dist_len})

    if ENABLE_RUST:
        assert len(data.get("dist")) == dist_len - 1
    else:
        assert not data.get("dist")
        assert len(data["errors"]) == 1
        assert data["errors"][0]["type"] == "value_too_long"
        assert data["errors"][0]["name"] == "dist"
        assert data["errors"][0]["value"] == "b" * dist_len


def test_distribution_bad_char():
    data = validate_and_normalize({"release": "a" * 62, "dist": "^%"})
    assert not data.get("dist")
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "dist"
    assert data["errors"][0]["value"] == "^%"


def test_distribution_strip():
    data = validate_and_normalize({"release": "a" * 62, "dist": " foo "})
    assert data.get("dist") == "foo"


def test_distribution_as_non_string():
    data = validate_and_normalize({"release": "42", "dist": 23})
    assert data.get("release") == "42"
    if ENABLE_RUST:
        assert data.get("dist") is None
    else:
        assert data.get("dist") == "23"


def test_distribution_no_release():
    data = validate_and_normalize({"dist": 23})
    assert data.get("dist") is None


def test_valid_platform():
    data = validate_and_normalize({"platform": "python"})
    assert data.get("platform") == "python"


def test_no_platform():
    data = validate_and_normalize({})
    assert data.get("platform") == "other"


def test_invalid_platform():
    data = validate_and_normalize({"platform": "foobar"})
    assert data.get("platform") == "other"


@pytest.mark.skipif(ENABLE_RUST, reason='Rust allows larger environment')
def test_environment_too_long():
    data = validate_and_normalize({"environment": "a" * 65})
    assert not data.get("environment")
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "value_too_long"
    assert data["errors"][0]["name"] == "environment"
    assert data["errors"][0]["value"] == "a" * 65


def test_environment_invalid():
    data = validate_and_normalize({"environment": "a/b"})
    assert not data.get("environment")
    error, = data['errors']
    if ENABLE_RUST:
        error['type'] == 'invalid_data'
    else:
        error['type'] == 'invalid_environment'

    assert error["name"] == "environment"
    assert error["value"] == "a/b"


def test_environment_as_non_string():
    data = validate_and_normalize({"environment": 42})
    if ENABLE_RUST:
        assert data.get("environment") is None
    else:
        assert data.get("environment") == "42"


@pytest.mark.skipif(ENABLE_RUST, reason='attribute is not validated in Rust')
def test_time_spent_too_large():
    data = validate_and_normalize({"time_spent": 2147483647 + 1})
    assert not data.get("time_spent")
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "value_too_long"
    assert data["errors"][0]["name"] == "time_spent"
    assert data["errors"][0]["value"] == 2147483647 + 1


def test_time_spent_invalid():
    data = validate_and_normalize({"time_spent": "lol"})
    assert not data.get("time_spent")
    assert len(data["errors"]) == 1
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "time_spent"
    assert data["errors"][0]["value"] == "lol"


def test_time_spent_non_int():
    data = validate_and_normalize({"time_spent": "123"})
    if ENABLE_RUST:
        assert data["time_spent"] is None
    else:
        assert data["time_spent"] == 123


def test_fingerprints():
    data = validate_and_normalize({"fingerprint": "2012-01-01T10:30:45"})
    assert not data.get("fingerprint")
    assert data["errors"][0]["type"] == "invalid_data"
    assert data["errors"][0]["name"] == "fingerprint"

    data = validate_and_normalize({"fingerprint": ["foo", ["bar"]]})
    assert data.get("fingerprint") == ["foo"]
    # With rust, there will be errors emitted

    data = validate_and_normalize({"fingerprint": ["foo", None, "bar"]})
    assert data.get("fingerprint") == ["foo", "bar"]
    # With rust, there will be errors emitted

    data = validate_and_normalize(
        {"fingerprint": ["{{default}}", 1, "bar", 4.5, -2.7, True]}
    )
    assert data.get("fingerprint") == ["{{default}}", "1", "bar", "4", "-2", "True"]
    assert "errors" not in data

    data = validate_and_normalize({"fingerprint": ["{{default}}", 1e100, -1e100, 1e10]})
    assert data.get("fingerprint") == ["{{default}}", "10000000000"]
    if ENABLE_RUST:
        assert data["errors"] == [{'type': 'invalid_data',
                                   'name': 'fingerprint', 'value': [1e100, -1e100]}]
    else:
        assert "errors" not in data

    data = validate_and_normalize({"fingerprint": []})
    assert "fingerprint" not in data
    assert "errors" not in data

    data = validate_and_normalize({"fingerprint": [""]})
    assert data['fingerprint'] == ['']
    assert "errors" not in data


def test_messages():
    # Just 'message': wrap it in interface
    data = validate_and_normalize({"message": "foo is bar"})
    assert data["logentry"] == {"formatted": "foo is bar"}

    # both 'message' and interface with no 'formatted' value, put 'message'
    # into 'formatted'.
    data = validate_and_normalize(
        {
            "message": "foo is bar",
            "logentry": {"message": "something else"},
        }
    )
    assert data["logentry"] == {
        "formatted": "something else",
    }

    # both 'message' and complete interface, 'message' is discarded
    data = validate_and_normalize(
        {
            "message": "foo is bar",
            "logentry": {
                "message": "something else",
                "formatted": "something else formatted",
            },
        }
    )
    assert "errors" not in data
    assert data["logentry"] == {
        "message": "something else",
        "formatted": "something else formatted",
    }


@pytest.mark.skip(reason="Message behavior that didn't make a lot of sense.")
def test_messages_old_behavior():
    # both 'message' and complete valid interface but interface has the same
    # value for both keys so the 'formatted' value is discarded and ends up
    # being replaced with 'message'
    data = validate_and_normalize(
        {
            "message": "foo is bar",
            "logentry": {
                "message": "something else",
                "formatted": "something else",
            },
        }
    )
    assert "message" not in data
    assert "errors" not in data
    assert data["logentry"] == {
        "message": "something else",
        "formatted": "foo is bar",
    }

    # interface discarded as invalid, replaced by new interface containing
    # wrapped 'message'
    data = validate_and_normalize(
        {"message": "foo is bar", "logentry": {"invalid": "invalid"}}
    )
    assert "message" not in data
    assert len(data["errors"]) == 1
    assert data["logentry"] == {"message": "foo is bar"}
