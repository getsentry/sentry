from __future__ import absolute_import

import pytest

from sentry.models import EventError


@pytest.mark.parametrize(
    "error,type,message,data",
    (
        ({"type": "unknown_error"}, "unknown_error", "Unknown error", {}),
        ({"type": "unknown_error", "foo": "bar"}, "unknown_error", "Unknown error", {"foo": "bar"}),
        (
            {"type": "invalid_data", "name": "foo"},
            "invalid_data",
            "Discarded invalid value",
            {"name": "foo"},
        ),
        ({"type": "invalid_data"}, "invalid_data", "Discarded invalid value", {}),
        ({"type": "INVALID_ERROR_TYPE"}, "INVALID_ERROR_TYPE", "Unknown error", {}),
    ),
)
def test_event_error(error, type, message, data):
    assert EventError.get_message(error) == message
    assert EventError(error).type == type
    assert EventError(error).message == message
    assert EventError(error).data == data


def test_api_context():
    error = {"type": "unknown_error", "foo": "bar"}
    assert EventError(error).get_api_context() == {
        "type": "unknown_error",
        "message": "Unknown error",
        "data": {"foo": "bar"},
    }
