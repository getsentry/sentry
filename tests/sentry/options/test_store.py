from functools import cached_property
from time import time
from unittest.mock import MagicMock, patch
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

    def make_key(self, ttl=10, grace=10, key_name: str | None = None):
        if key_name is None:
            key_name = uuid1().hex
        return self.manager.make_key(key_name, "", object, 0, ttl, grace, None)

    def test_simple(self) -> None:
        store, key = self.store, self.key

        assert store.get(key) is None
        assert store.set(key, "bar", UpdateChannel.CLI)
        assert store.get(key) == "bar"
        assert store.get_last_update_channel(key) == UpdateChannel.CLI
        assert store.delete(key)

    def test_not_in_store(self) -> None:
        assert self.store.get_last_update_channel(self.key) is None

    def test_simple_without_cache(self) -> None:
        store = OptionsStore(cache=None)
        key = self.make_key(key_name="foo")

        with pytest.raises(AssertionError) as e:
            store.get(key)

        assert (
            str(e.value)
            == "Option 'foo' requested before cache initialization, which could result in excessive store queries"
        )

        with pytest.raises(AssertionError) as e:
            store.set(key, "bar", UpdateChannel.CLI)

        assert str(e.value) == "cache must be configured before mutating options"

        with pytest.raises(AssertionError) as e:
            store.delete(key)

        assert str(e.value) == "cache must be configured before mutating options"

    @override_settings(SENTRY_OPTIONS_COMPLAIN_ON_ERRORS=False)
    def test_db_and_cache_unavailable(self) -> None:
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
    def test_key_with_grace(self, mocked_time: MagicMock) -> None:
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
    def test_key_ttl(self, mocked_time: MagicMock) -> None:
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
    def test_clean_local_cache(self, mocked_time: MagicMock) -> None:
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

    def test_set_cache_many(self) -> None:
        store = self.store
        key1 = self.make_key()
        key2 = self.make_key()
        key3 = self.make_key()

        # Batch set multiple values using list of tuples
        result = store.set_cache_many([(key1, "val1"), (key2, "val2"), (key3, "val3")])
        assert result is True

        # Verify local cache was populated
        assert key1.cache_key in store._local_cache
        assert key2.cache_key in store._local_cache
        assert key3.cache_key in store._local_cache

        # Verify network cache was populated (flush local, then get)
        store.flush_local_cache()
        assert store.cache.get(key1.cache_key) == "val1"
        assert store.cache.get(key2.cache_key) == "val2"
        assert store.cache.get(key3.cache_key) == "val3"

    def test_set_cache_many_empty(self) -> None:
        store = self.store
        result = store.set_cache_many([])
        assert result is True

    def test_set_cache_many_without_cache(self) -> None:
        store = OptionsStore(cache=None)
        key = self.make_key()
        result = store.set_cache_many([(key, "val")])
        assert result is None

    def test_get_many_all_local_cache(self) -> None:
        store = self.store
        key1 = self.make_key()
        key2 = self.make_key()

        # Populate local cache via set
        store.set(key1, "val1", UpdateChannel.CLI)
        store.set(key2, "val2", UpdateChannel.CLI)

        # Get many should hit local cache only (no network calls)
        with patch.object(store.cache, "get_many") as mock_get_many:
            results = store.get_many([key1, key2])
            mock_get_many.assert_not_called()

        assert results == {key1.name: "val1", key2.name: "val2"}

    def test_get_many_all_network_cache(self) -> None:
        store = self.store
        key1 = self.make_key()
        key2 = self.make_key()

        # Populate network cache directly
        store.cache.set(key1.cache_key, "val1", 60)
        store.cache.set(key2.cache_key, "val2", 60)

        # Ensure local cache is empty
        store.flush_local_cache()

        results = store.get_many([key1, key2])
        assert results == {key1.name: "val1", key2.name: "val2"}

        # Local cache should now be populated
        assert key1.cache_key in store._local_cache
        assert key2.cache_key in store._local_cache

    def test_get_many_db_fallback(self) -> None:
        store = self.store
        key1 = self.make_key()
        key2 = self.make_key()

        # Store values in DB via full set
        store.set(key1, "db_val1", UpdateChannel.CLI)
        store.set(key2, "db_val2", UpdateChannel.CLI)

        # Clear all caches
        store.flush_local_cache()
        store.cache.clear()

        # get_many should fall back to DB
        results = store.get_many([key1, key2])
        assert results == {key1.name: "db_val1", key2.name: "db_val2"}

        # Should have populated both local and network cache
        assert key1.cache_key in store._local_cache
        assert key2.cache_key in store._local_cache
        assert store.cache.get(key1.cache_key) == "db_val1"
        assert store.cache.get(key2.cache_key) == "db_val2"

    def test_get_many_mixed_sources(self) -> None:
        store = self.store
        key1 = self.make_key()  # will be in local cache
        key2 = self.make_key()  # will be in network cache only
        key3 = self.make_key()  # will be in DB only
        key4 = self.make_key()  # won't exist anywhere

        # Set up key1 in local cache
        store.set(key1, "local_val", UpdateChannel.CLI)

        # Set up key2 in network cache only
        store.cache.set(key2.cache_key, "network_val", 60)

        # Set up key3 in DB only
        store.set(key3, "db_val", UpdateChannel.CLI)
        store.flush_local_cache()
        store.cache.delete(key3.cache_key)

        # Get all keys
        results = store.get_many([key1, key2, key3, key4])

        assert results[key1.name] == "local_val"
        assert results[key2.name] == "network_val"
        assert results[key3.name] == "db_val"
        assert key4.name not in results  # Not found anywhere

    def test_get_many_empty(self) -> None:
        store = self.store
        results = store.get_many([])
        assert results == {}

    @override_settings(SENTRY_OPTIONS_COMPLAIN_ON_ERRORS=False)
    def test_get_many_grace_fallback(self) -> None:
        store = self.store
        key1 = self.make_key(ttl=10, grace=20)

        # Populate local cache via set (creates entry with expiry and grace window)
        store.set(key1, "stale_val", UpdateChannel.CLI)

        # Advance time past TTL but within grace window
        with patch("sentry.options.store.time") as mocked_time:
            mocked_time.return_value = time() + 15  # past ttl=10, within grace=20

            # Local cache miss (expired), Redis fails, DB returns nothing
            with patch.object(store.cache, "get_many", side_effect=RuntimeError()):
                with patch.object(store, "get_store_many", return_value={}):
                    results = store.get_many([key1], silent=True)

            # Should return stale value from grace period fallback
            assert results == {key1.name: "stale_val"}

    @override_settings(SENTRY_OPTIONS_COMPLAIN_ON_ERRORS=False)
    def test_get_many_cache_error_falls_back_to_db(self) -> None:
        store = self.store
        key1 = self.make_key()

        # Store in DB
        store.set(key1, "db_val", UpdateChannel.CLI)
        store.flush_local_cache()
        store.cache.clear()

        # Make network cache fail
        with patch.object(store.cache, "get_many", side_effect=RuntimeError()):
            results = store.get_many([key1], silent=True)

        # Should still get value from DB
        assert results == {key1.name: "db_val"}
