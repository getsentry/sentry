import contextlib
import time
from collections.abc import Iterator
from threading import Thread
from unittest.mock import patch

import pytest

from sentry.buffer.redis import RedisBuffer
from sentry.event_manager import GroupInfo, assign_event_to_group, create_group_with_grouphashes
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.services.eventstore.models import Event
from sentry.testutils.pytest.fixtures import django_db_all

CONCURRENCY = 2


class FakeTransactionModule:
    @staticmethod
    @contextlib.contextmanager
    def atomic(*args: object, **kwds: object) -> Iterator[None]:
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
def test_group_creation_race(default_project: Project, lock_disabled: bool) -> None:
    with contextlib.ExitStack() as ctx:
        if lock_disabled:
            # Disable transaction isolation just within event manager, but not in
            # GroupHash.objects.get_or_create
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


@django_db_all
def test_lost_group_creation_race_updates_group_outside_transaction(
    default_project: Project,
) -> None:
    """
    Make the second event lose the group creation race without threads: link the grouphashes to a
    group first, then call `create_group_with_grouphashes` with them. The second event must go to
    the existing group, and its Redis buffer increment must run after the grouphash transaction
    ends. The buffer uses a Redis client that has the transaction check, so a Redis call inside the
    transaction makes this test fail.
    """
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
        redis_buffer = RedisBuffer()

        with patch("sentry.buffer.backend", redis_buffer):
            # The first event creates the group and links the grouphashes to it
            return_values: list[GroupInfo] = []
            save_event(default_project.id, return_values)
            [first_group_info] = return_values
            assert first_group_info.is_new
            group = first_group_info.group

            grouphashes = list(
                GroupHash.objects.filter(
                    project=default_project, hash__in=["pound_sign", "octothorpe"]
                )
            )
            assert len(grouphashes) == 2
            assert all(grouphash.group_id == group.id for grouphash in grouphashes)
            assert redis_buffer.get(Group, ["times_seen"], {"id": group.id}) == {"times_seen": 0}

            # The second event gets to group creation, but finds the group under the row lock
            event = Event(
                default_project.id,
                "21212012123120120415201309082013",
                data={"timestamp": time.time()},
            )
            group_info = create_group_with_grouphashes(
                {"event_metadata": {}, "release": "dogpark", "event": event, "data": {}},
                grouphashes,
            )

            assert group_info is not None
            assert group_info.group.id == group.id
            assert group_info.is_new is False
            assert group_info.is_regression is False

            # The `times_seen` increment went through `RedisBuffer.incr`
            assert redis_buffer.get(Group, ["times_seen"], {"id": group.id}) == {"times_seen": 1}
