from __future__ import annotations

from collections.abc import Sequence
from unittest import mock

import pytest

from sentry import options
from sentry.options.rollout import in_random_rollout, in_rollout_group, in_rollout_group_batch
from sentry.testutils.helpers.options import override_options


@pytest.fixture
def register_option():
    options.register("feature.rollout", default=0.0, flags=options.FLAG_AUTOMATOR_MODIFIABLE)

    yield

    options.unregister("feature.rollout")


def run_random_sample(option_name: str) -> Sequence[int]:
    success = 0
    failure = 0
    for _ in range(0, 1000):
        if in_random_rollout(option_name):
            success += 1
        else:
            failure += 1
    return (success, failure)


def test_in_random_rollout(register_option) -> None:
    success = 0
    failure = 0

    with override_options({"feature.rollout": 0.0}):
        success, failure = run_random_sample("feature.rollout")
        assert success == 0
        assert failure == 1000

    with override_options({"feature.rollout": 0.25}):
        success, failure = run_random_sample("feature.rollout")
        assert success + failure == 1000
        assert 0.15 < success / (failure + success) < 0.35, "within margin of error"

    with override_options({"feature.rollout": 0.75}):
        success, failure = run_random_sample("feature.rollout")
        assert success + failure == 1000
        assert 0.65 < success / (failure + success) < 0.85, "within margin of error"

    with override_options({"feature.rollout": 1.0}):
        success, failure = run_random_sample("feature.rollout")
        assert success == 1000
        assert failure == 0


def run_rollout_group(option_name: str, id: int | str) -> Sequence[int]:
    success = 0
    failure = 0
    for _ in range(0, 1000):
        if in_rollout_group(option_name, key=id):
            success += 1
        else:
            failure += 1
    return (success, failure)


def test_in_rollout_group_int(register_option) -> None:
    with override_options({"feature.rollout": 0.25}):
        success, failure = run_rollout_group("feature.rollout", 123456871)
        assert success == 0
        assert failure == 1000

        success, failure = run_rollout_group("feature.rollout", 12346)
        assert success == 1000
        assert failure == 0


def test_in_rollout_group_str(register_option) -> None:
    with override_options({"feature.rollout": 0.25}):
        success, failure = run_rollout_group("feature.rollout", "some-value")
        assert success == 0
        assert failure == 1000

        success, failure = run_rollout_group("feature.rollout", "another-value-123")
        assert success == 1000
        assert failure == 0


def test_in_rollout_group_batch_matches_per_key(register_option) -> None:
    keys = list(range(10000, 20000)) + ["some-value", "another-value-123"]

    for rate in (0.0, 0.25, 0.75, 1.0):
        with override_options({"feature.rollout": rate}):
            assert in_rollout_group_batch("feature.rollout", keys) == [
                key for key in keys if in_rollout_group("feature.rollout", key)
            ]


def test_in_rollout_group_batch_preserves_order(register_option) -> None:
    with override_options({"feature.rollout": 0.25}):
        assert in_rollout_group_batch("feature.rollout", [12346, 123456871, 12347]) == [
            12346,
            12347,
        ]


def test_in_rollout_group_batch_reads_the_option_once(register_option) -> None:
    """The option read, not the bucketing, is what makes the per-key call slow at scale."""
    with override_options({"feature.rollout": 0.25}):
        with mock.patch("sentry.options.get", wraps=options.get) as get:
            in_rollout_group_batch("feature.rollout", range(1000))

    assert get.call_count == 1
