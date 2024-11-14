import pytest
from django.test import override_settings

from sentry.metrics.middleware import (
    BadMetricTags,
    _filter_tags,
    add_global_tags,
    get_current_global_tags,
    global_tags,
)


def test_filter_tags_dev():
    with override_settings(SENTRY_METRICS_DISALLOW_BAD_TAGS=True):
        _filter_tags("x", {"foo": "bar"})
        with pytest.raises(
            BadMetricTags,
            match=r"discarded illegal metric tags: \['event', 'foo_id', 'project'\] for metric 'x'",
        ):
            _filter_tags("x", {"foo": "bar", "foo_id": 42, "project": 42, "event": 22})


def test_filter_tags_prod():
    with override_settings(SENTRY_METRICS_DISALLOW_BAD_TAGS=False):
        assert _filter_tags("x", {"foo": "bar"}) == {"foo": "bar"}
        assert _filter_tags("x", {"foo": "bar", "foo_id": 42, "project": 42, "event": 22}) == {
            "foo": "bar"
        }


def test_global():
    assert get_current_global_tags() == {}

    with global_tags(tag_a=123):
        assert get_current_global_tags() == {"tag_a": 123}
        add_global_tags(tag_b=123)

        assert get_current_global_tags() == {"tag_a": 123, "tag_b": 123}

    assert get_current_global_tags() == {}
