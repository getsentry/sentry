from uuid import uuid4

from sentry.eventstore.processing.multiredis import MultiRedisProcessingStore
from sentry.testutils.helpers.options import override_options
from sentry.utils import json
from sentry.utils.cache import cache_key_for_event
from sentry.utils.redis import redis_clusters


def make_event():
    # Quacks like an event enough for eventstore
    return {
        "event_id": uuid4().hex,
        "project": 123,
    }


def test_store_and_get():
    adapter = MultiRedisProcessingStore(
        **{
            "old_cluster": "default",
            "new_cluster": "default",
        }
    )
    event = make_event()
    key = adapter.store(event)
    result = adapter.get(key)
    assert result == event


@override_options(
    {
        "redis.clusters": {
            "new": {
                "hosts": {0: {"db": 0}},
            },
            "old": {
                "hosts": {0: {"db": 1}},
            },
        }
    }
)
def test_get_from_old():
    event = make_event()
    adapter = MultiRedisProcessingStore(
        **{
            "old_cluster": "old",
            "new_cluster": "new",
        }
    )
    # Insert into the old 'cluster'
    key = cache_key_for_event(event)
    old_cluster = redis_clusters.get("old")
    old_cluster.set(key, json.dumps(event))

    result = adapter.get(key)
    assert result == event


def test_delete_by_key():
    adapter = MultiRedisProcessingStore(
        **{
            "old_cluster": "default",
            "new_cluster": "default",
        }
    )
    event = make_event()
    key = adapter.store(event)
    assert adapter.get(key)
    adapter.delete_by_key(key)
    assert not adapter.get(key)


def test_delete():
    adapter = MultiRedisProcessingStore(
        **{
            "old_cluster": "default",
            "new_cluster": "default",
        }
    )
    event = make_event()
    key = adapter.store(event)
    assert adapter.get(key)
    adapter.delete(event)
    assert not adapter.get(key)


@override_options(
    {
        "redis.clusters": {
            "new": {
                "hosts": {0: {"db": 0}},
            },
            "old": {
                "hosts": {0: {"db": 1}},
            },
        }
    }
)
def test_delete_both():
    adapter = MultiRedisProcessingStore(
        **{
            "old_cluster": "default",
            "new_cluster": "default",
        }
    )
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
