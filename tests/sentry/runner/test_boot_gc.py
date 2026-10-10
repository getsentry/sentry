import os
from collections.abc import Generator
from unittest import mock

import pytest

from sentry.runner import boot_gc
from sentry.runner.boot_gc import frozen_after_boot


class FakeGC:
    """Records collector calls. Tests must never freeze the real test process."""

    def __init__(self, enabled: bool = True) -> None:
        self.enabled = enabled
        self.calls: list[str] = []

    def isenabled(self) -> bool:
        return self.enabled

    def disable(self) -> None:
        self.calls.append("disable")
        self.enabled = False

    def enable(self) -> None:
        self.calls.append("enable")
        self.enabled = True

    def collect(self) -> int:
        self.calls.append("collect")
        return 7

    def freeze(self) -> None:
        self.calls.append("freeze")


@pytest.fixture(autouse=True)
def kill_switch_unset() -> Generator[None]:
    # Tests must not depend on a SENTRY_BOOT_GC_FREEZE exported in the shell.
    with mock.patch.dict(os.environ):
        os.environ.pop("SENTRY_BOOT_GC_FREEZE", None)
        yield


@pytest.fixture
def fake_gc() -> Generator[FakeGC]:
    fake = FakeGC()
    with mock.patch.object(boot_gc, "gc", fake):
        yield fake


@pytest.fixture
def distribution() -> Generator[mock.MagicMock]:
    with mock.patch("sentry.utils.metrics.distribution") as distribution:
        yield distribution


def test_pauses_during_boot_then_collects_and_freezes(
    fake_gc: FakeGC, distribution: mock.MagicMock
) -> None:
    with frozen_after_boot("configure"):
        assert fake_gc.calls == ["disable"]

    assert fake_gc.calls == ["disable", "collect", "freeze", "enable"]
    assert fake_gc.enabled is True
    distribution.assert_has_calls(
        [
            mock.call(
                "runner.boot_gc.duration",
                mock.ANY,
                tags={"point": "configure"},
                unit="millisecond",
                sample_rate=1.0,
            ),
            mock.call("runner.boot_gc.collected", 7, tags={"point": "configure"}, sample_rate=1.0),
        ]
    )


def test_boot_failure_reenables_gc_without_freezing(
    fake_gc: FakeGC, distribution: mock.MagicMock
) -> None:
    with pytest.raises(ValueError):
        with frozen_after_boot("configure"):
            raise ValueError("bad config")

    assert fake_gc.calls == ["disable", "enable"]
    assert fake_gc.enabled is True
    distribution.assert_not_called()


def test_keyboard_interrupt_reenables_gc(fake_gc: FakeGC, distribution: mock.MagicMock) -> None:
    with pytest.raises(KeyboardInterrupt):
        with frozen_after_boot("configure"):
            raise KeyboardInterrupt

    assert fake_gc.calls == ["disable", "enable"]
    distribution.assert_not_called()


def test_does_nothing_when_gc_is_already_disabled(
    fake_gc: FakeGC, distribution: mock.MagicMock
) -> None:
    fake_gc.enabled = False

    with frozen_after_boot("configure"):
        pass

    assert fake_gc.calls == []
    assert fake_gc.enabled is False
    distribution.assert_not_called()


def test_nested_windows_collect_and_freeze_once(
    fake_gc: FakeGC, distribution: mock.MagicMock
) -> None:
    with frozen_after_boot("wsgi_warmup"):
        with frozen_after_boot("configure"):
            pass
        assert fake_gc.calls == ["disable"]

    assert fake_gc.calls == ["disable", "collect", "freeze", "enable"]
    distribution.assert_any_call(
        "runner.boot_gc.collected", 7, tags={"point": "wsgi_warmup"}, sample_rate=1.0
    )


@pytest.mark.parametrize("value", ["0", "false", "False", "OFF", " no ", "n"])
def test_kill_switch_leaves_gc_alone(
    value: str, fake_gc: FakeGC, distribution: mock.MagicMock
) -> None:
    # The literal name, not the constant: operators rely on it.
    with mock.patch.dict(os.environ, {"SENTRY_BOOT_GC_FREEZE": value}):
        with frozen_after_boot("configure"):
            pass

    assert fake_gc.calls == []
    distribution.assert_not_called()


@pytest.mark.parametrize("value", ["1", "", "true", "yes", "anything"])
def test_other_kill_switch_values_keep_the_freeze(
    value: str, fake_gc: FakeGC, distribution: mock.MagicMock
) -> None:
    with mock.patch.dict(os.environ, {"SENTRY_BOOT_GC_FREEZE": value}):
        with frozen_after_boot("configure"):
            pass

    assert fake_gc.calls == ["disable", "collect", "freeze", "enable"]
