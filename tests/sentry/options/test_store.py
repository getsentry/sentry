from functools import cached_property
from unittest.mock import MagicMock, patch
from uuid import uuid1

import pytest
from django.conf import settings
from django.core.cache.backends.locmem import LocMemCache
from django.test import override_settings

from sentry.models.options.option import Option
from sentry.options.manager import DEFAULT_FLAGS, OptionsManager, UpdateChannel
from sentry.options.store import OptionsStore
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import no_silo_test
from sentry.utils.types import Any


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


@no_silo_test
class ApplicationStateTest(TestCase):
    @cached_property
    def store(self):
        c = LocMemCache("application-state-test", {})
        c.clear()
        return OptionsStore(cache=c)

    @cached_property
    def manager(self):
        return OptionsManager(store=self.store)

    @pytest.fixture(autouse=True)
    def application_state_store(self):
        from sentry import application_state

        with patch.object(application_state, "default_store", self.store):
            yield

    def test_state_round_trip_uses_existing_storage(self) -> None:
        from sentry import application_state

        for name, value in [
            ("sentry:system-token", "existing-system-token"),
            ("sentry:install-id", "existing-installation"),
            ("sentry:latest_version", "1.2.3"),
            ("sentry:last_worker_ping", 1234.5),
            ("sentry:last_worker_version", "1.2.3"),
            ("sentry:version-configured", "1.2.3"),
        ]:
            with self.subTest(name=name):
                key = self.manager.make_key(name, lambda: "", Any, DEFAULT_FLAGS, 0, 0, None)
                self.store.set_store(key, value, UpdateChannel.UNKNOWN)
                assert application_state.get(name) == value
                assert application_state.set(name, value)
                assert Option.objects.get(key=name).value == value
                assert self.store.get(key) == value
                assert self.store.cache.get(key.cache_key) == value
                assert application_state.delete(name)
                assert not Option.objects.filter(key=name).exists()
                assert application_state.get(name) == ""

    def test_state_preserves_self_hosted_fallbacks(self) -> None:
        from sentry import application_state

        with self.settings(
            SENTRY_OPTIONS={"sentry:install-id": "configured-installation"},
            SENTRY_DEFAULT_OPTIONS={"sentry:install-id": "default-installation"},
        ):
            assert application_state.get("sentry:install-id") == "configured-installation"
            application_state.set("sentry:install-id", "stored-installation")
            assert application_state.get("sentry:install-id") == "stored-installation"
            application_state.delete("sentry:install-id")
        with self.settings(SENTRY_DEFAULT_OPTIONS={"sentry:install-id": "default-installation"}):
            assert application_state.get("sentry:install-id") == "default-installation"

    def test_state_bypasses_option_resolution(self) -> None:
        from sentry import application_state, options

        application_state.set("sentry:system-token", "existing-system-token")
        with patch.object(options.default_manager, "lookup_key", side_effect=AssertionError):
            with patch.object(options.default_manager, "_read_hook", side_effect=AssertionError):
                assert application_state.get("sentry:system-token") == "existing-system-token"

    def test_state_rejects_configuration_and_scoped_keys(self) -> None:
        from sentry import application_state

        for name in [
            "system.url-prefix",
            "sentry:skip-record-onboarding-tasks-if-complete",
            "sentry:_last_auto_resolve",
            "sentry:unknown",
            "getsentry:unknown",
        ]:
            with self.subTest(name=name):
                with pytest.raises(ValueError, match="Unknown application state key"):
                    application_state.get(name)
                with pytest.raises(ValueError, match="Unknown application state key"):
                    application_state.set(name, "value")
                with pytest.raises(ValueError, match="Unknown application state key"):
                    application_state.delete(name)
                assert not Option.objects.filter(key=name).exists()

    def test_state_does_not_coerce_values(self) -> None:
        from sentry import application_state

        with pytest.raises(TypeError):
            application_state.set("sentry:system-token", 123)
        with pytest.raises(TypeError):
            application_state.set("sentry:last_worker_ping", "123")
        assert not Option.objects.filter(key="sentry:system-token").exists()
        assert not Option.objects.filter(key="sentry:last_worker_ping").exists()
