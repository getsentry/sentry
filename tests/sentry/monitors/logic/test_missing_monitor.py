from django.core.cache import BaseCache

from sentry.monitors.logic import missing_monitor
from sentry.monitors.logic.missing_monitor import (
    clear_monitor_missing,
    is_monitor_marked_missing,
    mark_monitor_missing,
)


def test_mark_and_clear(django_cache: BaseCache) -> None:
    assert not is_monitor_marked_missing(1, "my-monitor")

    mark_monitor_missing(1, "my-monitor")
    assert is_monitor_marked_missing(1, "my-monitor")
    assert not is_monitor_marked_missing(2, "my-monitor")
    assert not is_monitor_marked_missing(1, "other-monitor")

    clear_monitor_missing(1, "my-monitor")
    assert not is_monitor_marked_missing(1, "my-monitor")


def test_clear_without_marker(django_cache: BaseCache) -> None:
    clear_monitor_missing(1, "never-marked")
    assert not is_monitor_marked_missing(1, "never-marked")


def test_marker_from_another_process_is_not_read(django_cache: BaseCache) -> None:
    mark_monitor_missing(1, "my-monitor")
    missing_monitor._marked_here.clear()

    assert not is_monitor_marked_missing(1, "my-monitor")


def test_cleared_marker_is_forgotten(django_cache: BaseCache) -> None:
    mark_monitor_missing(1, "my-monitor")
    clear_monitor_missing(1, "my-monitor")
    assert not is_monitor_marked_missing(1, "my-monitor")

    # A marker another process sets later stays unread here.
    django_cache.set(missing_monitor._missing_monitor_key(1, "my-monitor"), True)
    assert not is_monitor_marked_missing(1, "my-monitor")
