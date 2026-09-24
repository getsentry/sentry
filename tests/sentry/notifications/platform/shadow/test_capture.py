from __future__ import annotations

from unittest import mock

from sentry.notifications.platform.shadow.capture import (
    LegacyRender,
    ShadowCollector,
    collecting,
    is_collecting,
    record_legacy_render,
    record_metric_alert_context,
    record_platform_send,
)
from sentry.notifications.platform.types import NotificationProviderKey

CAPTURE_PATH = "sentry.notifications.platform.shadow.capture"


def test_records_nothing_outside_a_collector() -> None:
    assert not is_collecting()

    record_legacy_render(NotificationProviderKey.SLACK, {"blocks": []}, chart_url="https://chart")
    record_metric_alert_context(mock.sentinel.context)
    record_platform_send()

    assert not is_collecting()


def test_records_the_first_legacy_render() -> None:
    collector = ShadowCollector()

    with collecting(collector):
        assert is_collecting()
        record_legacy_render(NotificationProviderKey.SLACK, ("[]", "text"), chart_url="https://c")
        record_legacy_render(NotificationProviderKey.DISCORD, {"content": "second"})

    assert not is_collecting()
    assert collector.legacy == LegacyRender(
        provider=NotificationProviderKey.SLACK, payload=("[]", "text"), chart_url="https://c"
    )


def test_records_metric_alert_context_and_platform_send() -> None:
    collector = ShadowCollector()

    with collecting(collector):
        record_metric_alert_context(mock.sentinel.context)
        record_metric_alert_context(mock.sentinel.other)
        record_platform_send()

    assert collector.metric_context is mock.sentinel.context
    assert collector.platform_sent
    assert collector.legacy is None


def test_collectors_are_restored_when_nested() -> None:
    outer, inner = ShadowCollector(), ShadowCollector()

    with collecting(outer):
        with collecting(inner):
            record_platform_send()
        record_legacy_render(NotificationProviderKey.MSTEAMS, {"type": "AdaptiveCard"})

    assert inner.platform_sent and inner.legacy is None
    assert not outer.platform_sent and outer.legacy is not None


def test_record_failures_do_not_propagate() -> None:
    collector = ShadowCollector()

    with (
        collecting(collector),
        mock.patch(f"{CAPTURE_PATH}.LegacyRender", side_effect=RuntimeError("boom")),
        mock.patch(f"{CAPTURE_PATH}.logger") as mock_logger,
    ):
        record_legacy_render(NotificationProviderKey.SLACK, {"blocks": []})

    assert collector.legacy is None
    mock_logger.exception.assert_called_once()


def test_context_failures_do_not_propagate() -> None:
    with (
        mock.patch(f"{CAPTURE_PATH}._active_collector") as mock_var,
        mock.patch(f"{CAPTURE_PATH}.logger") as mock_logger,
    ):
        mock_var.get.side_effect = RuntimeError("boom")
        record_legacy_render(NotificationProviderKey.SLACK, {"blocks": []})
        record_metric_alert_context(mock.sentinel.context)
        record_platform_send()

    assert mock_logger.exception.call_count == 3
