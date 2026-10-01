from __future__ import annotations

from unittest import mock

from sentry.notifications.platform.shadow.capture import (
    LegacyRender,
    collecting,
    record_legacy_render,
)
from sentry.notifications.platform.types import NotificationProviderKey

CAPTURE_PATH = "sentry.notifications.platform.shadow.capture"


def test_records_nothing_outside_a_collector() -> None:
    with mock.patch(f"{CAPTURE_PATH}.LegacyRender") as mock_render:
        record_legacy_render(
            NotificationProviderKey.SLACK, {"blocks": []}, chart_url="https://chart"
        )

    mock_render.assert_not_called()


def test_records_the_first_legacy_render() -> None:
    with collecting() as collector:
        record_legacy_render(
            NotificationProviderKey.SLACK, {"text": "first"}, chart_url="https://c"
        )
        record_legacy_render(NotificationProviderKey.DISCORD, {"content": "second"})

    assert collector.legacy_render == LegacyRender(
        provider=NotificationProviderKey.SLACK, payload={"text": "first"}, chart_url="https://c"
    )


def test_record_failures_do_not_propagate() -> None:
    with (
        collecting() as collector,
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
