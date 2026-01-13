from functools import cached_property
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid1

import pytest
from django.conf import settings
from django.core.cache.backends.locmem import LocMemCache
from django.db import DatabaseError, OperationalError
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

    def test_lock_contention_handling(self) -> None:
        """Test that set_store gracefully handles lock contention without blocking."""
        store, key = self.store, self.key

        # First, create the option
        store.set(key, "initial", UpdateChannel.CLI)
        assert store.get(key) == "initial"

        # Mock select_for_update to raise OperationalError simulating lock contention
        with patch.object(
            Option.objects, "select_for_update"
        ) as mock_select_for_update:
            mock_queryset = Mock()
            mock_queryset.get.side_effect = OperationalError("could not obtain lock")
            mock_select_for_update.return_value = mock_queryset

            # This should not raise an exception, but skip the update gracefully
            store.set_store(key, "locked", UpdateChannel.CLI)

            # Verify select_for_update was called with nowait=True
            mock_select_for_update.assert_called_once_with(nowait=True)

        # The value should remain unchanged since the update was skipped
        store.flush_local_cache()
        assert store.get(key) == "initial"

    def test_lock_contention_on_create(self) -> None:
        """Test that concurrent creates are handled gracefully."""
        store = self.store
        key = self.make_key()

        # Mock select_for_update to raise DoesNotExist, then mock create to raise DatabaseError
        with patch.object(
            Option.objects, "select_for_update"
        ) as mock_select_for_update:
            mock_queryset = Mock()
            mock_queryset.get.side_effect = Option.DoesNotExist
            mock_select_for_update.return_value = mock_queryset

            with patch.object(
                Option.objects, "create", side_effect=DatabaseError("duplicate key value")
            ):
                # This should not raise an exception
                store.set_store(key, "concurrent", UpdateChannel.CLI)

        # The option should not exist since both operations failed
        assert store.get_store(key, silent=True) is None

    @override_settings(SENTRY_OPTIONS_COMPLAIN_ON_ERRORS=True)
    def test_unexpected_database_error_with_complain(self) -> None:
        """Test that unexpected database errors are raised when COMPLAIN_ON_ERRORS is True."""
        store, key = self.store, self.key

        # Create the option first
        store.set(key, "initial", UpdateChannel.CLI)

        # Mock select_for_update to raise a non-lock related DatabaseError
        with patch.object(
            Option.objects, "select_for_update"
        ) as mock_select_for_update:
            mock_queryset = Mock()
            mock_queryset.get.side_effect = DatabaseError("connection lost")
            mock_select_for_update.return_value = mock_queryset

            # This should raise the exception since it's not a lock error
            with pytest.raises(DatabaseError, match="connection lost"):
                store.set_store(key, "error", UpdateChannel.CLI)

    @override_settings(SENTRY_OPTIONS_COMPLAIN_ON_ERRORS=False)
    def test_unexpected_database_error_without_complain(self) -> None:
        """Test that unexpected database errors are logged but not raised when COMPLAIN_ON_ERRORS is False."""
        store, key = self.store, self.key

        # Create the option first
        store.set(key, "initial", UpdateChannel.CLI)

        # Mock select_for_update to raise a non-lock related DatabaseError
        with patch.object(
            Option.objects, "select_for_update"
        ) as mock_select_for_update:
            mock_queryset = Mock()
            mock_queryset.get.side_effect = DatabaseError("connection lost")
            mock_select_for_update.return_value = mock_queryset

            # This should not raise, just log
            store.set_store(key, "error", UpdateChannel.CLI)
