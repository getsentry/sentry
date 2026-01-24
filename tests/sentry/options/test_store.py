from functools import cached_property
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

    def test_get_many_all_cache_hits(self) -> None:
        """Test get_many when all keys are in cache"""
        store = self.store

        # Create and set multiple keys
        keys = [self.make_key(key_name=f"test_key_{i}") for i in range(3)]
        for i, key in enumerate(keys):
            store.set(key, f"value_{i}", UpdateChannel.CLI)

        # Batch fetch should return all values
        results = store.get_many(keys)

        assert len(results) == 3
        for i, key in enumerate(keys):
            assert results[key] == f"value_{i}"

    def test_get_many_mixed_cache_db(self) -> None:
        """Test get_many with some keys in cache, some in DB only"""
        store = self.store

        # Create three keys
        key1 = self.make_key(key_name="cached_key")
        key2 = self.make_key(key_name="db_key")
        key3 = self.make_key(key_name="missing_key")

        # Set key1 in both cache and DB
        store.set(key1, "cached_value", UpdateChannel.CLI)

        # Set key2 in DB but clear from cache
        store.set(key2, "db_value", UpdateChannel.CLI)
        store.cache.delete(key2.cache_key)
        store.flush_local_cache()

        # key3 is not set anywhere (should not be in results)

        # Batch fetch
        results = store.get_many([key1, key2, key3])

        assert len(results) == 2  # Only key1 and key2 found
        assert results[key1] == "cached_value"
        assert results[key2] == "db_value"
        assert key3 not in results

    def test_get_many_empty_keys(self) -> None:
        """Test get_many with empty list of keys"""
        store = self.store
        results = store.get_many([])
        assert results == {}

    def test_get_many_all_missing(self) -> None:
        """Test get_many when no keys are found"""
        store = self.store
        keys = [self.make_key(key_name=f"missing_{i}") for i in range(3)]

        results = store.get_many(keys)

        # Should return empty dict since none exist
        assert results == {}

    @override_settings(SENTRY_OPTIONS_COMPLAIN_ON_ERRORS=False)
    @patch("sentry.options.store.time")
    def test_get_many_with_grace(self, mocked_time: MagicMock) -> None:
        """Test get_many with grace period fallback"""
        store = self.store

        mocked_time.return_value = 0

        # Create keys with different grace periods
        key1 = self.make_key(ttl=10, grace=10, key_name="grace_key_1")
        key2 = self.make_key(ttl=10, grace=10, key_name="grace_key_2")

        store.set(key1, "value1", UpdateChannel.CLI)
        store.set(key2, "value2", UpdateChannel.CLI)

        # Simulate cache and DB being unavailable, but within grace period
        with patch.object(Option.objects, "get_queryset", side_effect=RuntimeError()):
            with patch.object(store.cache, "get_many", side_effect=RuntimeError()):
                mocked_time.return_value = 15  # Beyond TTL but within grace

                results = store.get_many([key1, key2])

                # Should still return values from local cache grace period
                assert len(results) == 2
                assert results[key1] == "value1"
                assert results[key2] == "value2"

    @override_settings(SENTRY_OPTIONS_COMPLAIN_ON_ERRORS=False)
    def test_get_many_redis_error(self) -> None:
        """Test get_many handles Redis errors gracefully"""
        store = self.store

        # Create keys in database
        key1 = self.make_key(key_name="db_key_1")
        key2 = self.make_key(key_name="db_key_2")

        store.set(key1, "value1", UpdateChannel.CLI)
        store.set(key2, "value2", UpdateChannel.CLI)

        # Clear caches to force Redis fetch
        store.flush_local_cache()

        # Simulate Redis error - should fall back to database
        with patch.object(store.cache, "get_many", side_effect=RuntimeError()):
            results = store.get_many([key1, key2])

            # Should still get values from database
            assert len(results) == 2
            assert results[key1] == "value1"
            assert results[key2] == "value2"

    def test_get_many_populates_local_cache(self) -> None:
        """Test that get_many populates local cache for future requests"""
        store = self.store

        # Create keys in database only
        keys = [self.make_key(key_name=f"cache_populate_{i}") for i in range(3)]
        for i, key in enumerate(keys):
            store.set(key, f"value_{i}", UpdateChannel.CLI)

        # Clear local cache
        store.flush_local_cache()

        # First batch fetch - should populate local cache
        results = store.get_many(keys)
        assert len(results) == 3

        # Verify local cache was populated
        for key in keys:
            assert key.cache_key in store._local_cache

        # Second fetch should hit local cache (no Redis/DB access needed)
        with patch.object(store.cache, "get_many") as mock_get_many:
            with patch.object(Option.objects, "filter") as mock_filter:
                results2 = store.get_many(keys)

                # Should return same results
                assert results == results2

                # Should not have called Redis or DB
                mock_get_many.assert_not_called()
                mock_filter.assert_not_called()
