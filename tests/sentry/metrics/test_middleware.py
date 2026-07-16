from unittest import mock

import pytest
from django.test import override_settings

from sentry.metrics.dummy import DummyMetricsBackend
from sentry.metrics.middleware import (
    BadMetricTags,
    MiddlewareWrapper,
    _filter_tags,
    add_global_tags,
    get_current_global_tags,
    global_tags,
)


def test_filter_tags_dev() -> None:
    with override_settings(SENTRY_METRICS_DISALLOW_BAD_TAGS=True):
        _filter_tags("x", {"foo": "bar"})
        with pytest.raises(
            BadMetricTags,
            match=r"discarded illegal metric tags: \['event', 'foo_id', 'project'\] for metric 'x'",
        ):
            _filter_tags("x", {"foo": "bar", "foo_id": 42, "project": 42, "event": 22})


def test_filter_tags_prod() -> None:
    with override_settings(SENTRY_METRICS_DISALLOW_BAD_TAGS=False):
        assert _filter_tags("x", {"foo": "bar"}) == {"foo": "bar"}
        assert _filter_tags("x", {"foo": "bar", "foo_id": 42, "project": 42, "event": 22}) == {
            "foo": "bar"
        }


def test_global() -> None:
    assert get_current_global_tags() == {}

    with global_tags(tags={"tag_a": 123}):
        assert get_current_global_tags() == {"tag_a": 123}
        add_global_tags(tags={"tag_b": 123})

        assert get_current_global_tags() == {"tag_a": 123, "tag_b": 123}

    assert get_current_global_tags() == {}


def test_middleware_set_forwards_global_tags_and_filters_bad_tags() -> None:
    inner = mock.Mock(spec=DummyMetricsBackend)
    wrapper = MiddlewareWrapper(inner)

    with global_tags(tags={"global_tag": "value"}):
        with override_settings(SENTRY_METRICS_DISALLOW_BAD_TAGS=False):
            wrapper.set("metric", 42, tags={"good": "tag", "org_id": 99})

    inner.set.assert_called_once_with(
        "metric", 42, None, {"global_tag": "value", "good": "tag"}, 1, 1
    )
