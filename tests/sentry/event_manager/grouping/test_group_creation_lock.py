import contextlib
import time
from threading import Thread
from unittest.mock import patch

import pytest

from sentry.event_manager import GroupInfo, assign_event_to_group
from sentry.services.eventstore.models import Event
from sentry.testutils.pytest.fixtures import django_db_all

CONCURRENCY = 2


class FakeTransactionModule:
    @staticmethod
    @contextlib.contextmanager
    def atomic(*args, **kwds):
        yield


def save_event(project_id: int, return_values: list[GroupInfo]) -> None:
    event = Event(
        project_id,
        "11212012123120120415201309082013",
        data={"timestamp": time.time()},
    )

    group_info = assign_event_to_group(
        event=event,
        job={"event_metadata": {}, "release": "dogpark", "event": event, "data": {}},
        metric_tags={},
    )

    assert group_info is not None
    return_values.append(group_info)


@django_db_all(transaction=True)
@pytest.mark.parametrize(
    "lock_disabled",
    [
        # Group creation with transaction isolation (which is what powers the lock) disabled, to
        # show that without it, multiple groups are created when there's a race condition while
        # ingesting events with the same data. This variant exists so that we can ensure the test
        # would detect a malfunctioning lock in principle, and does not just always pass because of
        # low parallelism. In a sense this variant tests the efficacy of this test, not actual
        # business logic.
        #
        # If this variant fails, CONCURRENCY needs to be increased or e.g. thread barriers need to
        # be used to ensure data races. This does not seem to be necessary so far.
        True,
        # Regular group creation, in which the lock should be working
        False,
    ],
    ids=(" lock_disabled: True ", " lock_disabled: False "),
)
def test_group_creation_race(default_project, lock_disabled) -> None:
    with contextlib.ExitStack() as ctx:
        if lock_disabled:
            # Disable transaction isolation just within event manager, but not in
            # GroupHash.objects.create_or_update
            ctx.enter_context(patch("sentry.event_manager.transaction", FakeTransactionModule))

            # `select_for_update` cannot be used outside of transactions
            ctx.enter_context(
                patch("django.db.models.QuerySet.select_for_update", lambda self: self)
            )

        with (
            patch(
                "sentry.grouping.ingest.hashing._calculate_event_grouping",
                return_value=(["pound_sign", "octothorpe"], {}),
            ),
            patch(
                "sentry.event_manager._get_group_processing_kwargs",
                return_value={"level": 10, "culprit": "", "data": {}},
            ),
            patch("sentry.event_manager._materialize_metadata_many"),
        ):
            return_values: list[GroupInfo] = []
            threads = []

            # Save the same event data in multiple threads. If the lock is working, only one new group
            # should be created
            for _ in range(CONCURRENCY):
                thread = Thread(target=save_event, args=[default_project.id, return_values])
                thread.start()
                threads.append(thread)

            for thread in threads:
                thread.join()

        if not lock_disabled:
            # assert only one new group was created
            assert len({group_info.group.id for group_info in return_values}) == 1
            assert sum(group_info.is_new for group_info in return_values) == 1
        else:
            # assert multiple new groups were created
            assert 1 < len({group_info.group.id for group_info in return_values}) <= CONCURRENCY
            assert 1 < sum(group_info.is_new for group_info in return_values) <= CONCURRENCY
