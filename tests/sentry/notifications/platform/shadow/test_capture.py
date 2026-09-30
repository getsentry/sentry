from __future__ import annotations

from unittest import mock

from sentry.notifications.platform.shadow.capture import (
    LegacyRender,
    ShadowCollector,
    collecting,
    is_collecting,
    record_legacy_render,
)
from sentry.notifications.platform.types import NotificationProviderKey

CAPTURE_PATH = "sentry.notifications.platform.shadow.capture"


def test_records_nothing_outside_a_collector() -> None:
    assert not is_collecting()

    record_legacy_render(NotificationProviderKey.SLACK, {"blocks": []}, chart_url="https://chart")

    assert not is_collecting()


def test_records_the_first_legacy_render() -> None:
    collector = ShadowCollector()

    with collecting(collector):
        assert is_collecting()
        record_legacy_render(NotificationProviderKey.SLACK, ("[]", "text"), chart_url="https://c")
        record_legacy_render(NotificationProviderKey.DISCORD, {"content": "second"})

    assert not is_collecting()
    assert collector.legacy_render == LegacyRender(
        provider=NotificationProviderKey.SLACK, payload=("[]", "text"), chart_url="https://c"
    )


def test_collectors_are_restored_when_nested() -> None:
    outer, inner = ShadowCollector(), ShadowCollector()

    with collecting(outer):
        with collecting(inner):
            record_legacy_render(NotificationProviderKey.SLACK, {"blocks": []})
        record_legacy_render(NotificationProviderKey.MSTEAMS, {"type": "AdaptiveCard"})

    assert inner.legacy_render == LegacyRender(
        provider=NotificationProviderKey.SLACK, payload={"blocks": []}, chart_url=None
    )
    assert outer.legacy_render == LegacyRender(
        provider=NotificationProviderKey.MSTEAMS, payload={"type": "AdaptiveCard"}, chart_url=None
    )


def test_record_failures_do_not_propagate() -> None:
    collector = ShadowCollector()

    with (
        collecting(collector),
        mock.patch(f"{CAPTURE_PATH}.LegacyRender", side_effect=RuntimeError("boom")),
        mock.patch(f"{CAPTURE_PATH}.logger") as mock_logger,
    ):
        record_legacy_render(NotificationProviderKey.SLACK, {"blocks": []})

    assert collector.legacy_render is None
    mock_logger.exception.assert_called_once()


def test_context_failures_do_not_propagate() -> None:
    with (
        mock.patch(f"{CAPTURE_PATH}._active_collector") as mock_var,
        mock.patch(f"{CAPTURE_PATH}.logger") as mock_logger,
    ):
        mock_var.get.side_effect = RuntimeError("boom")
        record_legacy_render(NotificationProviderKey.SLACK, {"blocks": []})

    mock_logger.exception.assert_called_once()
