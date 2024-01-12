from functools import cached_property
from unittest.mock import patch
from uuid import uuid1

import pytest
from django.conf import settings
from django.core.cache.backends.locmem import LocMemCache
from django.test import override_settings

from sentry.models.options.option import Option
from sentry.options.manager import OptionsManager, UpdateChannel
from sentry.options.store import OptionsStore
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class OptionsStoreTest(TestCase):
    @cached_property
    def store(self):
        c = LocMemCache("test", settings.CACHES["default"])
        c.clear()
        return OptionsStore(cache=c)

    @cached_property
    def manager(self):
        return OptionsManager(store=self.store)

    @cached_property
    def key(self):
        return self.make_key()

    @pytest.fixture(autouse=True)
    def flush_local_cache(self):
        self.store.flush_local_cache()

    def make_key(self, ttl=10, grace=10):
        return self.manager.make_key(uuid1().hex, "", object, 0, ttl, grace, None)

    def test_simple(self):
        store, key = self.store, self.key

        assert store.get(key) is None
        assert store.set(key, "bar", UpdateChannel.CLI)
        assert store.get(key) == "bar"
        assert store.get_last_update_channel(key) == UpdateChannel.CLI
        assert store.delete(key)

    def test_not_in_store(self):
        assert self.store.get_last_update_channel(self.key) is None

    def test_simple_without_cache(self):
        store = OptionsStore(cache=None)
        key = self.key

        assert store.get(key) is None

        with pytest.raises(AssertionError):
            store.set(key, "bar", UpdateChannel.CLI)

        with pytest.raises(AssertionError):
            store.delete(key)

    @override_settings(SENTRY_OPTIONS_COMPLAIN_ON_ERRORS=False)
    def test_db_and_cache_unavailable(self):
        store, key = self.store, self.key
        with patch.object(Option.objects, "get_queryset", side_effect=RuntimeError()):
            # we can't update options if the db is unavailable
            with pytest.raises(RuntimeError):
                store.set(key, "bar", UpdateChannel.CLI)

        # Assert nothing was written to the local_cache
        assert not store._local_cache

        store.set(key, "bar", UpdateChannel.CLI)

        with patch.object(Option.objects, "get_queryset", side_effect=RuntimeError()):
            assert store.get(key) == "bar"

            with patch.object(store.cache, "get", side_effect=RuntimeError()):
                assert store.get(key) == "bar"
                store.flush_local_cache()
                assert store.get(key) is None

    @override_settings(SENTRY_OPTIONS_COMPLAIN_ON_ERRORS=False)
    @patch("sentry.options.store.time")
    def test_key_with_grace(self, mocked_time):
        store, key = self.store, self.make_key(10, 10)

        mocked_time.return_value = 0
        store.set(key, "bar", UpdateChannel.CLI)

        with patch.object(Option.objects, "get_queryset", side_effect=RuntimeError()):
            with patch.object(store.cache, "get", side_effect=RuntimeError()):
                # Serves the value beyond TTL
                mocked_time.return_value = 15
                assert store.get(key) == "bar"

                mocked_time.return_value = 21
                assert store.get(key) is None

                # It should have also been evicted
                assert not store._local_cache

    @override_settings(SENTRY_OPTIONS_COMPLAIN_ON_ERRORS=False)
    @patch("sentry.options.store.time")
    def test_key_ttl(self, mocked_time):
        store, key = self.store, self.make_key(10, 0)

        mocked_time.return_value = 0
        store.set(key, "bar", UpdateChannel.CLI)

        with patch.object(Option.objects, "get_queryset", side_effect=RuntimeError()):
            with patch.object(store.cache, "get", side_effect=RuntimeError()):
                assert store.get(key) == "bar"

        Option.objects.filter(key=key.name).update(value="lol")
        store.cache.delete(key.cache_key)
        # Still within TTL, so don't check database
        assert store.get(key) == "bar"

        mocked_time.return_value = 15

        with patch.object(Option.objects, "get_queryset", side_effect=RuntimeError()):
            with patch.object(store.cache, "get", side_effect=RuntimeError()):
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

        store.set(key1, "x", UpdateChannel.CLI)
        store.set(key2, "x", UpdateChannel.CLI)
        store.set(key3, "x", UpdateChannel.CLI)
        store.set(key4, "x", UpdateChannel.CLI)

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
