from __future__ import annotations

from collections.abc import Callable, Iterator
from contextlib import contextmanager

import sentry_sdk

from sentry.seer.autofix.pr_iteration.tracing import (
    ITERATION_ID_ATTRIBUTE,
    TRIGGER_ID_ATTRIBUTE,
    set_pr_iteration_attributes,
)


def _scope_attributes() -> dict[str, object]:
    return dict(sentry_sdk.get_isolation_scope()._attributes)


@contextmanager
def _recorded_attributes() -> Iterator[Callable[[], dict[str, object]]]:
    """A forked scope, and what the body added to it.

    Asserting on the delta rather than the whole scope: a scope carries whatever
    the surrounding process already set on it, which is the point of these
    attributes and not something a test should have to clear.
    """
    with sentry_sdk.isolation_scope():
        before = _scope_attributes()
        yield lambda: {k: v for k, v in _scope_attributes().items() if before.get(k) != v}


def test_writes_every_id_it_is_given() -> None:
    with _recorded_attributes() as added:
        set_pr_iteration_attributes(
            run_id=11,
            organization_id=22,
            group_id=33,
            iteration_id=44,
            trigger_id="deadbeef",
        )

        assert added() == {
            "run_id": 11,
            "organization_id": 22,
            "group_id": 33,
            ITERATION_ID_ATTRIBUTE: 44,
            TRIGGER_ID_ATTRIBUTE: "deadbeef",
        }


def test_drops_unresolved_ids_rather_than_writing_none() -> None:
    """A stage that resolved only some of the ids still records those."""
    with _recorded_attributes() as added:
        set_pr_iteration_attributes(run_id=11, organization_id=22)

        assert added() == {"run_id": 11, "organization_id": 22}


def test_later_calls_add_to_the_earlier_ones() -> None:
    """Stages record what they hold as they resolve it, across several calls."""
    with _recorded_attributes() as added:
        set_pr_iteration_attributes(run_id=11, organization_id=22)
        set_pr_iteration_attributes(group_id=33, iteration_id=44)

        assert added() == {
            "run_id": 11,
            "organization_id": 22,
            "group_id": 33,
            ITERATION_ID_ATTRIBUTE: 44,
        }


def test_attributes_do_not_outlive_the_isolation_scope() -> None:
    """What keeps one stage's ids off the next stage's spans."""
    sentinel = 987654321
    with sentry_sdk.isolation_scope():
        set_pr_iteration_attributes(run_id=sentinel)
        assert _scope_attributes()["run_id"] == sentinel

    assert _scope_attributes().get("run_id") != sentinel
