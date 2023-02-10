import logging
from unittest import mock

import pytest
from django.test import override_settings

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
        assert thing(10) == 10

        assert timing.call_count == 1
        args, kwargs = timing.call_args
        assert args[0] == "key"
        assert args[3] == {"foo": True, "result": "success"}


def test_global():
    assert metrics._get_current_global_tags() == {}

    with metrics.global_tags(tag_a=123):
        assert metrics._get_current_global_tags() == {"tag_a": 123}
        metrics.add_global_tags(tag_b=123)

        assert metrics._get_current_global_tags() == {"tag_a": 123, "tag_b": 123}

    assert metrics._get_current_global_tags() == {}


def test_filter_tags(caplog):
    with override_settings(SENTRY_METRICS_WARN_BAD_TAGS=True), caplog.at_level(
        logging.WARNING, logger="sentry.metrics"
    ):
        assert metrics._filter_tags({"foo": "bar"}) == {"foo": "bar"}
        assert metrics._filter_tags(
            {"foo": "bar", "foo_id": 42, "project": 42, "group": 99, "event": 22}
        ) == {"foo": "bar"}
        assert caplog.record_tuples == [
            (
                "sentry.metrics",
                30,
                "discarded illegal metric tags: ['event', 'foo_id', 'group', 'project']",
            )
        ]
