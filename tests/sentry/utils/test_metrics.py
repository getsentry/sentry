from __future__ import absolute_import

from sentry.utils.compat import mock
import pytest

from sentry.utils import metrics


def test_timer_success():
    with mock.patch("sentry.utils.metrics.timing") as timing:
        with metrics.timer("key", tags={"foo": True}) as tags:
            tags["bar"] = False

        assert timing.call_count == 1
        args, kwargs = timing.call_args
        assert args[0] == "key"
        assert args[3] == {"foo": True, "bar": False, "result": "success"}


class ExpectedError(Exception):
    pass


def test_timer_failure():
    with mock.patch("sentry.utils.metrics.timing") as timing:
        with pytest.raises(ExpectedError):
            with metrics.timer("key", tags={"foo": True}):
                raise ExpectedError

        assert timing.call_count == 1
        args, kwargs = timing.call_args
        assert args[0] == "key"
        assert args[3] == {"foo": True, "result": "failure"}


def test_wraps():
    @metrics.wraps("key", tags={"foo": True})
    def thing(a):
        return a

    with mock.patch("sentry.utils.metrics.timing") as timing:
        thing(10) == 10

        assert timing.call_count == 1
        args, kwargs = timing.call_args
        assert args[0] == "key"
        assert args[3] == {"foo": True, "result": "success"}
