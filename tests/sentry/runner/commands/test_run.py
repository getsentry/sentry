from unittest import mock

import pytest

from sentry.runner.commands import run
from sentry.viewer_context import ActorType, ViewerContext, get_viewer_context


@pytest.mark.parametrize(
    ("value", "expected"),
    (
        (None, (None, None)),
        ("192.168.1.1", ("192.168.1.1", None)),
        ("192.168.1.1:9001", ("192.168.1.1", 9001)),
    ),
)
def test_address_validate(value: str | None, expected: tuple[str | None, int | None]) -> None:
    ctx, param = mock.Mock(), mock.Mock()
    assert run._address_validate(ctx, param, value) == expected


def test_taskworker_scheduler_tick_sets_system_viewer_context() -> None:
    runner = mock.Mock()

    def tick() -> float:
        assert get_viewer_context() == ViewerContext(actor_type=ActorType.SYSTEM)
        return 1.0

    runner.tick.side_effect = tick

    assert run._tick_taskworker_scheduler(runner) == 1.0
    assert get_viewer_context() is None
