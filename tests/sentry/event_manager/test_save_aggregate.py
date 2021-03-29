import contextlib
import pytest
import time

from threading import Thread

from sentry.eventstore.models import Event
from sentry.event_manager import _save_aggregate, _save_aggregate2


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(
    "save_aggregate_version",
    [
        # New group creation code, which is supposed to not have races
        "new_save_aggregate",
        # New group creation code with removed transaction isolation, which is then
        # supposed to create multiple groups. This variant exists such that we can
        # ensure the test would find race conditions in principle, and does not
        # just always pass because of low parallelism. In a sense this variant
        # tests the efficacy of this test, not actual business logic.
        #
        # If this variant fails, CONCURRENCY needs to be increased or e.g. thread
        # barriers need to be used to ensure data races. This does not seem to be
        # necessary so far.
        "new_broken_save_aggregate",
        # Old group creation code which is "supposed to" have races
        "old_save_aggregate",
    ],
)
def test_group_creation_race(monkeypatch, default_project, save_aggregate_version):
    CONCURRENCY = 2

    new_variant = save_aggregate_version in ("new_save_aggregate", "new_broken_save_aggregate")
    is_race_free = save_aggregate_version == "new_save_aggregate"

    if save_aggregate_version == "new_broken_save_aggregate":

        class FakeTransactionModule:
            @staticmethod
            @contextlib.contextmanager
            def atomic():
                yield

        # Disable transaction isolation just within event manager, but not in
        # GroupHash.objects.create_or_update
        monkeypatch.setattr("sentry.event_manager.transaction", FakeTransactionModule)

        # select_for_update cannot be used outside of transactions
        monkeypatch.setattr("django.db.models.QuerySet.select_for_update", lambda self: self)

    if new_variant:
        save_aggregate = _save_aggregate2
    else:
        save_aggregate = _save_aggregate

    return_values = []

    def save_event():
        data = {"timestamp": time.time()}
        evt = Event(
            default_project.id,
            "89aeed6a472e4c5fb992d14df4d7e1b6",
            data=data,
        )

        return_values.append(
            save_aggregate(
                evt,
                flat_hashes=["a" * 32, "b" * 32],
                hierarchical_hashes=[],
                release=None,
                data=data,
                level=10,
                culprit="",
            )
        )

    threads = []
    for _ in range(CONCURRENCY):
        thread = Thread(target=save_event)
        thread.start()
        threads.append(thread)

    for thread in threads:
        thread.join()

    if is_race_free:
        # assert one group is new
        assert len({rv[0].id for rv in return_values}) == 1
        assert sum(rv[1] for rv in return_values) == 1
    else:
        # assert many groups are new
        assert 1 < len({rv[0].id for rv in return_values}) <= CONCURRENCY
        assert 1 < sum(rv[1] for rv in return_values) <= CONCURRENCY
