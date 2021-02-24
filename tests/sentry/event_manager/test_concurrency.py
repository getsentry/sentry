import contextlib
import pytest

from threading import Thread

from sentry.event_manager import EventManager
from sentry.testutils.helpers import Feature


@pytest.fixture(
    params=[
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
    ]
)
def is_race_free(request, monkeypatch):
    new_variant = request.param in ("new_save_aggregate", "new_broken_save_aggregate")
    is_race_free = request.param == "new_save_aggregate"

    if request.param == "new_broken_save_aggregate":

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

    with Feature({"projects:race-free-group-creation": new_variant}):
        yield is_race_free


@pytest.mark.django_db(transaction=True)
def test_group_creation_race(monkeypatch, default_project, is_race_free):
    CONCURRENCY = 2

    events = []

    def save_event():
        mgr = EventManager({"fingerprint": ["group1"]})
        mgr.normalize()
        events.append(mgr.save(default_project.id))

    threads = []
    for _ in range(CONCURRENCY):
        thread = Thread(target=save_event)
        thread.start()
        threads.append(thread)

    for thread in threads:
        thread.join()

    if is_race_free:
        assert len({e.group_id for e in events}) == 1
    else:
        assert 1 < len({e.group_id for e in events}) <= CONCURRENCY
