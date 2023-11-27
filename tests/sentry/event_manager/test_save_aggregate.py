import contextlib
import time
from threading import Thread

import pytest
from django.db import router, transaction

from sentry.event_manager import _save_aggregate
from sentry.eventstore.models import Event
from sentry.grouping.result import CalculatedHashes
from sentry.models.grouphash import GroupHash
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test


@django_db_all(transaction=True)
@pytest.mark.parametrize(
    "is_race_free",
    [
        # regular group creation code, which is supposed to not have races
        True,
        # group creation code with removed transaction isolation, which is then
        # supposed to create multiple groups. This variant exists such that we can
        # ensure the test would find race conditions in principle, and does not
        # just always pass because of low parallelism. In a sense this variant
        # tests the efficacy of this test, not actual business logic.
        #
        # If this variant fails, CONCURRENCY needs to be increased or e.g. thread
        # barriers need to be used to ensure data races. This does not seem to be
        # necessary so far.
        False,
    ],
)
@region_silo_test
def test_group_creation_race(monkeypatch, default_project, is_race_free):
    CONCURRENCY = 2

    if not is_race_free:

        class FakeTransactionModule:
            @staticmethod
            @contextlib.contextmanager
            def atomic(*args, **kwds):
                yield

        # Disable transaction isolation just within event manager, but not in
        # GroupHash.objects.create_or_update
        monkeypatch.setattr("sentry.event_manager.transaction", FakeTransactionModule)

        # select_for_update cannot be used outside of transactions
        monkeypatch.setattr("django.db.models.QuerySet.select_for_update", lambda self: self)

    return_values = []

    def save_event():
        try:
            data = {"timestamp": time.time()}
            evt = Event(
                default_project.id,
                "89aeed6a472e4c5fb992d14df4d7e1b6",
                data=data,
            )
            ret = _save_aggregate(
                evt,
                hashes=CalculatedHashes(
                    hashes=["a" * 32, "b" * 32],
                    hierarchical_hashes=[],
                    tree_labels=[],
                ),
                release=None,
                metadata={},
                received_timestamp=0,
                level=10,
                culprit="",
            )
            assert ret is not None
            return_values.append(ret)
        finally:
            transaction.get_connection(router.db_for_write(GroupHash)).close()

    threads = []
    for _ in range(CONCURRENCY):
        thread = Thread(target=save_event)
        thread.start()
        threads.append(thread)

    for thread in threads:
        thread.join()

    if is_race_free:
        # assert one group is new
        assert len({rv.group.id for rv in return_values}) == 1
        assert sum(rv.is_new for rv in return_values) == 1
    else:
        # assert many groups are new
        assert 1 < len({rv.group.id for rv in return_values}) <= CONCURRENCY
        assert 1 < sum(rv.is_new for rv in return_values) <= CONCURRENCY
