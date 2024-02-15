from uuid import uuid4

from sentry.eventstore.processing.multiredis import MultiRedisProcessingStore
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils import json
from sentry.utils.cache import cache_key_for_event
from sentry.utils.redis import redis_clusters

cluster_config = {
    "new": {
        "hosts": {0: {"db": 1}},
    },
    "old": {
        "hosts": {0: {"db": 0}},
    },
}


def make_event():
    # Quacks like an event enough for eventstore
    return {
        "event_id": uuid4().hex,
        "project": 123,
    }


class MultiRedisTest(TestCase):
    @override_options({"redis.clusters": cluster_config, "eventstore.processing.rollout": 1.0})
    def test_store_and_get_with_new(self):
        adapter = MultiRedisProcessingStore(old_cluster="old", new_cluster="new")
        event = make_event()
        key = adapter.store(event)
        result = adapter.get(key)
        assert result == event

        old_cluster = redis_clusters.get("old")
        assert old_cluster.get(key) is None

    @override_options({"redis.clusters": cluster_config, "eventstore.processing.rollout": 0.0})
    def test_store_and_get_with_old(self):
        adapter = MultiRedisProcessingStore(old_cluster="old", new_cluster="new")
        event = make_event()
        key = adapter.store(event)
        result = adapter.get(key)
        assert result == event

        old_cluster = redis_clusters.get("old")
        assert old_cluster.get(key)

        new_cluster = redis_clusters.get("new")
        assert new_cluster.get(key) is None

    @override_options({"redis.clusters": cluster_config})
    def test_write_old_read_new(self):
        adapter = MultiRedisProcessingStore(old_cluster="old", new_cluster="new")
        # write to the old cluster
        with override_options({"eventstore.processing.rollout": 0.0}):
            event = make_event()
            key = adapter.store(event)

        # Shift entirely to new cluster, we should still be able to read old data
        with override_options({"eventstore.processing.rollout": 1.0}):
            result = adapter.get(key)
        assert result == event

    @override_options({"redis.clusters": cluster_config})
    def test_store_new_read_old(self):
        adapter = MultiRedisProcessingStore(old_cluster="old", new_cluster="new")
        # write to the new cluster
        with override_options({"eventstore.processing.rollout": 1.0}):
            event = make_event()
            key = adapter.store(event)
            assert adapter.get(key) == event

        # Shift writes to old, can still read old
        with override_options({"eventstore.processing.rollout": 0.0}):
            assert adapter.get(key) == event

        old_cluster = redis_clusters.get("old")
        assert old_cluster.get(key) is None

        new_cluster = redis_clusters.get("new")
        assert new_cluster.get(key)

    @override_options({"redis.clusters": cluster_config})
    def test_store_new_no_old_read(self):
        adapter = MultiRedisProcessingStore(old_cluster="old", new_cluster="new")
        # write to the old cluster
        with override_options({"eventstore.processing.rollout": 0.0}):
            event = make_event()
            key = adapter.store(event)

        # Shift traffic to new, can still read from old
        with override_options({"eventstore.processing.rollout": 1.0}):
            assert adapter.get(key) == event

        # Disable old reads
        with override_options(
            {"eventstore.processing.rollout": 1.0, "eventstore.processing.readold": False}
        ):
            assert adapter.get(key) is None

    @override_options({"redis.clusters": cluster_config})
    def test_old_read_disabled(self):
        event = make_event()
        adapter = MultiRedisProcessingStore(old_cluster="old", new_cluster="new")
        # Insert into the old 'cluster'
        key = cache_key_for_event(event)
        old_cluster = redis_clusters.get("old")
        old_cluster.set(key, '{"key":"should not be read"}')

        with override_options(
            {"eventstore.processing.rollout": 1.0, "eventstore.processing.readold": False}
        ):
            key = adapter.store(event)
            assert adapter.get(key) == event

        with override_options({"eventstore.processing.rollout": 0.0}):
            assert adapter.get(key) == {"key": "should not be read"}

    @override_options({"redis.clusters": cluster_config, "eventstore.processing.rollout": 1.0})
    def test_delete_by_key(self):
        adapter = MultiRedisProcessingStore(old_cluster="old", new_cluster="new")
        event = make_event()
        key = adapter.store(event)
        assert adapter.get(key)
        adapter.delete_by_key(key)
        assert not adapter.get(key)

    @override_options({"redis.clusters": cluster_config, "eventstore.processing.rollout": 1.0})
    def test_delete(self):
        adapter = MultiRedisProcessingStore(old_cluster="old", new_cluster="new")
        event = make_event()
        key = adapter.store(event)
        assert adapter.get(key)
        adapter.delete(event)
        assert not adapter.get(key)

    @override_options({"redis.clusters": cluster_config})
    def test_delete_both(self):
        adapter = MultiRedisProcessingStore(old_cluster="old", new_cluster="new")
        event = make_event()
        # Insert into the old 'cluster'
        key = cache_key_for_event(event)
        old_cluster = redis_clusters.get("old")
        old_cluster.set(key, json.dumps(event))
        # Write to and read from the new cluster
        key = adapter.store(event)
        assert adapter.get(key)

        # delete from both, as reads cascade between new and old
        adapter.delete(event)
        assert not adapter.get(key)
