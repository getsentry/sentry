from collections.abc import Generator
from contextlib import contextmanager
from unittest import mock

import click
import pytest

from sentry.runner import settings as runner_settings


@pytest.fixture
def boot_events() -> Generator[list[object]]:
    events: list[object] = []

    @contextmanager
    def fake_window(point: str) -> Generator[None]:
        events.append(("enter", point))
        yield
        events.append(("exit", point))

    with mock.patch.object(runner_settings, "frozen_after_boot", fake_window):
        yield events


@pytest.mark.parametrize("skip_service_validation", [True, False])
def test_configure_boots_inside_the_gc_window(
    boot_events: list[object], skip_service_validation: bool
) -> None:
    ctx = click.Context(click.Command("sentry"))
    with (
        mock.patch.object(runner_settings, "__installed", False),
        mock.patch.object(
            runner_settings,
            "_configure",
            side_effect=lambda *args: boot_events.append(("boot", args)),
        ),
    ):
        runner_settings.configure(
            ctx, "sentry.conf.py", "config.yml", skip_service_validation=skip_service_validation
        )

        assert getattr(runner_settings, "__installed") is True

    assert boot_events == [
        ("enter", "configure"),
        ("boot", (ctx, "sentry.conf.py", "config.yml", skip_service_validation)),
        ("exit", "configure"),
    ]


def test_configure_does_nothing_once_installed(boot_events: list[object]) -> None:
    with (
        mock.patch.object(runner_settings, "__installed", True),
        mock.patch.object(runner_settings, "_configure") as _configure,
    ):
        runner_settings.configure(None, "sentry.conf.py", "config.yml")

    _configure.assert_not_called()
    assert boot_events == []


def test_failed_configure_can_be_retried(boot_events: list[object]) -> None:
    with (
        mock.patch.object(runner_settings, "__installed", False),
        mock.patch.object(runner_settings, "_configure", side_effect=ValueError("no config")),
    ):
        with pytest.raises(ValueError):
            runner_settings.configure(None, "sentry.conf.py", "config.yml")

        assert getattr(runner_settings, "__installed") is False
