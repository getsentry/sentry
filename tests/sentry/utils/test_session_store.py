from unittest import TestCase
from unittest.mock import PropertyMock, patch

from django.test import Client, RequestFactory

from sentry.utils.session_store import RedisSessionStore, redis_property
from sentry.utils.json import dumps, loads


class LaggyRedisClient:
    """
    Simulate a Redis deployment where reads can lag behind writes by maintaining
    separate primary/replica stores. Scripts run on the primary to match Redis behavior.
    """

    def __init__(self) -> None:
        self.primary: dict[str, str] = {}
        self.replica: dict[str, str] = {}
        self.ttl: int | None = None

    def setex(self, key: str, ttl: int, value: str) -> None:
        self.primary[key] = value
        self.ttl = ttl

    def get(self, key: str) -> str | None:
        return self.replica.get(key)

    def delete(self, key: str) -> None:
        self.primary.pop(key, None)
        self.replica.pop(key, None)

    def eval(self, script: str, numkeys: int, *keys_and_args: str) -> int:
        redis_key, field, value_json, ttl = keys_and_args
        current = self.primary.get(redis_key)
        if current is None:
            return 0
        state = loads(current)
        state[field] = loads(value_json)
        self.primary[redis_key] = dumps(state)
        self.ttl = int(ttl)
        return 1

    def sync_replica(self, key: str) -> None:
        if key in self.primary:
            self.replica[key] = self.primary[key]


class RedisSessionStoreTestCase(TestCase):
    class TestRedisSessionStore(RedisSessionStore):
        some_value = redis_property("some_value")

    def setUp(self) -> None:
        self.request = RequestFactory().get("")
        self.request.session = Client().session

        self.store = self.TestRedisSessionStore(self.request, "test-store")

    def test_store_values(self) -> None:
        self.store.regenerate()

        assert "store:test-store" in self.request.session

        self.store.some_value = "test_value"
        assert self.store.get_state()
        store2 = self.TestRedisSessionStore(self.request, "test-store")

        assert store2.is_valid()
        assert store2.get_state()
        assert store2.some_value == "test_value"

        assert not hasattr(self.store, "missing_key")

        self.store.clear()
        assert self.request.session.modified

    def test_store_complex_object(self) -> None:
        self.store.regenerate({"some_value": {"deep_object": "value"}})

        store2 = self.TestRedisSessionStore(self.request, "test-store")

        assert store2.some_value["deep_object"] == "value"

        self.store.clear()

    def test_uninitialized_store(self) -> None:
        assert self.store.is_valid() is False
        assert self.store.get_state() is None
        assert self.store.some_value is None

        self.store.clear()

    def test_malformed_state(self) -> None:
        self.store.regenerate()
        client = self.store._client

        assert "store:test-store" in self.request.session
        self.store.some_value = "test_value"

        assert self.store.is_valid()
        assert self.store.get_state()

        # Redis session store should be bulletproof in case redis state values are invalid json.
        # For example, random bit flips caused by cosmic rays.
        client.setex(self.store.redis_key, self.store.ttl, "invalid json")

        assert self.store.is_valid() is False
        assert self.store.get_state() is None

    def test_atomic_updates_ignore_replica_lag(self) -> None:
        laggy_client = LaggyRedisClient()

        with patch.object(RedisSessionStore, "_client", new_callable=PropertyMock) as mock_client:
            mock_client.return_value = laggy_client

            self.store.regenerate({"data": {}, "step_index": 0})
            redis_key = self.store.redis_key
            assert redis_key is not None

            laggy_client.sync_replica(redis_key)

            data = self.store.data or {}
            data["state"] = "oauth-state"
            self.store.data = data

            # Replica has not caught up yet, so reads still return the stale payload.
            assert (self.store.data or {}).get("state") is None

            self.store.step_index = 1

            saved_state = loads(laggy_client.primary[redis_key])
            assert saved_state["data"]["state"] == "oauth-state"
            assert saved_state["step_index"] == 1
