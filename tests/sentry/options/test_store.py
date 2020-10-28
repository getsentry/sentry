# -*- coding: utf-8 -*-

from __future__ import absolute_import

from uuid import uuid1

import pytest
from exam import before, fixture
from sentry.utils.compat.mock import patch
from django.core.cache.backends.locmem import LocMemCache

from sentry.models import Option
from sentry.options.store import OptionsStore
from sentry.testutils import TestCase


class OptionsStoreTest(TestCase):
    @fixture
    def store(self):
        c = LocMemCache("test", {})
        c.clear()
        return OptionsStore(cache=c)

    @fixture
    def key(self):
        return self.make_key()

    @before
    def flush_local_cache(self):
        self.store.flush_local_cache()

    def make_key(self, ttl=10, grace=10):
        return self.store.make_key(uuid1().hex, "", object, 0, ttl, grace)

    def test_simple(self):
        store, key = self.store, self.key

        assert store.get(key) is None
        assert store.set(key, "bar")
        assert store.get(key) == "bar"
        assert store.delete(key)

    def test_simple_without_cache(self):
        store = OptionsStore(cache=None)
        key = self.key

        assert store.get(key) is None

        with pytest.raises(AssertionError):
            store.set(key, "bar")

        with pytest.raises(AssertionError):
            store.delete(key)

    def test_db_and_cache_unavailable(self):
        store, key = self.store, self.key
        with patch.object(Option.objects, "get_queryset", side_effect=Exception()):
            # we can't update options if the db is unavailable
            with self.assertRaises(Exception):
                store.set(key, "bar")

        # Assert nothing was written to the local_cache
        assert not store._local_cache

        store.set(key, "bar")

        with patch.object(Option.objects, "get_queryset", side_effect=Exception()):
            assert store.get(key) == "bar"

            with patch.object(store.cache, "get", side_effect=Exception()):
                assert store.get(key) == "bar"
                store.flush_local_cache()
                assert store.get(key) is None

    @patch("sentry.options.store.time")
    def test_key_with_grace(self, mocked_time):
        store, key = self.store, self.make_key(10, 10)

        mocked_time.return_value = 0
        store.set(key, "bar")

        with patch.object(Option.objects, "get_queryset", side_effect=Exception()):
            with patch.object(store.cache, "get", side_effect=Exception()):
                # Serves the value beyond TTL
                mocked_time.return_value = 15
                assert store.get(key) == "bar"

                mocked_time.return_value = 21
                assert store.get(key) is None

                # It should have also been evicted
                assert not store._local_cache

    @patch("sentry.options.store.time")
    def test_key_ttl(self, mocked_time):
        store, key = self.store, self.make_key(10, 0)

        mocked_time.return_value = 0
        store.set(key, "bar")

        with patch.object(Option.objects, "get_queryset", side_effect=Exception()):
            with patch.object(store.cache, "get", side_effect=Exception()):
                assert store.get(key) == "bar"

        Option.objects.filter(key=key.name).update(value="lol")
        store.cache.delete(key.cache_key)
        # Still within TTL, so don't check database
        assert store.get(key) == "bar"

        mocked_time.return_value = 15

        with patch.object(Option.objects, "get_queryset", side_effect=Exception()):
            with patch.object(store.cache, "get", side_effect=Exception()):
                assert store.get(key) is None

        assert store.get(key) == "lol"

    @patch("sentry.options.store.time")
    def test_clean_local_cache(self, mocked_time):
        store = self.store

        mocked_time.return_value = 0

        key1 = self.make_key(10, 0)  # should expire after 10
        key2 = self.make_key(10, 5)  # should expire after 15
        key3 = self.make_key(10, 10)  # should expire after 20
        key4 = self.make_key(10, 15)  # should expire after 25

        store.set(key1, "x")
        store.set(key2, "x")
        store.set(key3, "x")
        store.set(key4, "x")

        assert len(store._local_cache) == 4

        mocked_time.return_value = 0
        store.clean_local_cache()
        assert len(store._local_cache) == 4

        mocked_time.return_value = 11
        store.clean_local_cache()
        assert len(store._local_cache) == 3
        assert key1.cache_key not in store._local_cache

        mocked_time.return_value = 21
        store.clean_local_cache()
        assert len(store._local_cache) == 1
        assert key1.cache_key not in store._local_cache
        assert key2.cache_key not in store._local_cache
        assert key3.cache_key not in store._local_cache

        mocked_time.return_value = 26
        store.clean_local_cache()
        assert not store._local_cache
