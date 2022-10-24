from unittest import TestCase

import pytest
from django.test import Client, RequestFactory

from sentry.utils.session_store import RedisSessionStore, redis_property


class RedisSessionStoreTestCase(TestCase):
    class TestRedisSessionStore(RedisSessionStore):
        some_value = redis_property("some_value")

    def setUp(self) -> None:
        self.request = RequestFactory().get("")
        self.request.session = Client().session

        self.store = self.TestRedisSessionStore(self.request, "test-store")

    def test_store_values(self):
        self.store.regenerate()

        assert "store:test-store" in self.request.session

        self.store.some_value = "test_value"
        assert self.store.get_state()
        store2 = self.TestRedisSessionStore(self.request, "test-store")

        assert store2.is_valid()
        assert store2.get_state()
        assert store2.some_value == "test_value"

        with pytest.raises(AttributeError):
            self.store.missing_key

        self.store.clear()
        assert self.request.session.modified

    def test_store_complex_object(self):
        self.store.regenerate({"some_value": {"deep_object": "value"}})

        store2 = self.TestRedisSessionStore(self.request, "test-store")

        assert store2.some_value["deep_object"] == "value"

        self.store.clear()

    def test_uninitialized_store(self):
        assert self.store.is_valid() is False
        assert self.store.get_state() is None
        assert self.store.some_value is None

        self.store.clear()

    def test_malformed_state(self):
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
