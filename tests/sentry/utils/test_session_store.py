from __future__ import absolute_import

from django.http import HttpRequest

from unittest import TestCase
from sentry.utils.session_store import RedisSessionStore


class RedisSessionStoreTestCase(TestCase):
    def test_store_values(self):
        request = HttpRequest()
        request.session = {}

        store = RedisSessionStore(request, "test-store")
        store.regenerate()

        assert "store:test-store" in request.session

        store.some_value = "test_value"
        store2 = RedisSessionStore(request, "test-store")

        assert store2.is_valid()
        assert store2.some_value == "test_value"

        with self.assertRaises(AttributeError):
            store.missing_key

        store.clear()

    def test_store_complex_object(self):
        request = HttpRequest()
        request.session = {}

        store = RedisSessionStore(request, "test-store")
        store.regenerate({"some_value": {"deep_object": "value"}})

        store2 = RedisSessionStore(request, "test-store")

        assert store2.some_value["deep_object"] == "value"

        store.clear()

    def test_uninitialized_store(self):
        request = HttpRequest()
        request.session = {}

        store = RedisSessionStore(request, "test-store")

        assert not store.is_valid()
        assert store.get_state() is None
        assert store.some_key is None

        store.setting_but_no_state = "anything"
        assert store.setting_but_no_state is None

        store.clear()
