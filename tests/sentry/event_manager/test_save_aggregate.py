import contextlib
import time
from threading import Thread
from typing import Any
from unittest.mock import patch

import pytest
from django.db import router, transaction

from sentry.event_manager import _save_aggregate_new
from sentry.eventstore.models import Event
from sentry.models.grouphash import GroupHash
from sentry.testutils.pytest.fixtures import django_db_all


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
    ids=(" is_race_free: True ", " is_race_free: False "),
)
def test_group_creation_race_new(monkeypatch, default_project, is_race_free):
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

    event = Event(
        default_project.id,
        "11212012123120120415201309082013",
        data={"timestamp": time.time()},
    )
    hashes = ["pound sign", "octothorpe"]

    group_processing_kwargs = {"level": 10, "culprit": "", "data": {}}
    save_aggregate_kwargs: Any = {
        "event": event,
        "job": {"event_metadata": {}, "release": "dogpark", "event": event, "data": {}},
        "metric_tags": {},
    }

    def save_event():
        try:
            with patch(
                "sentry.grouping.ingest.hashing._calculate_event_grouping",
                return_value=hashes,
            ):
                with patch(
                    "sentry.event_manager._get_group_processing_kwargs",
                    return_value=group_processing_kwargs,
                ):
                    with patch("sentry.event_manager._materialize_metadata_many"):
                        group_info = _save_aggregate_new(**save_aggregate_kwargs)

                        assert group_info is not None
                        return_values.append(group_info)
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
        # assert only one new group was created
        assert len({group_info.group.id for group_info in return_values}) == 1
        assert sum(group_info.is_new for group_info in return_values) == 1
    else:
        # assert multiple new groups were created
        assert 1 < len({group_info.group.id for group_info in return_values}) <= CONCURRENCY
        assert 1 < sum(group_info.is_new for group_info in return_values) <= CONCURRENCY
