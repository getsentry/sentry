from functools import cached_property
from typing import cast
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid1

import pytest
from django.conf import settings
from django.core.cache.backends.locmem import LocMemCache
from django.test import override_settings

from sentry import options
from sentry.models.options.option import Option
from sentry.options.manager import DEFAULT_FLAGS, OptionsManager, UpdateChannel
from sentry.options.store import OptionsStore
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import no_silo_test
from sentry.utils.types import Any


@pytest.mark.parametrize("method", ["set", "set_store"])
def test_retired_automator_channel_rejects_store_writes(method: str) -> None:
    cache = Mock()
    store = OptionsStore(cache=cache)
    model = Mock()
    key = options.default_manager.lookup_key("sentry:install-id")
    channel = UpdateChannel("automator")

    with patch.object(OptionsStore, "model", model):
        with pytest.raises(ValueError, match="automator update channel is retired"):
            getattr(store, method)(key, "changed", channel)

    assert model.mock_calls == []
    assert cache.mock_calls == []
    assert store._local_cache == {}


@pytest.mark.parametrize("channel", ["application", "automator", None])
@pytest.mark.parametrize("method", ["set", "set_store"])
def test_invalid_channels_reject_store_writes(channel: object, method: str) -> None:
    cache = Mock()
    store = OptionsStore(cache=cache)
    model = Mock()
    key = options.default_manager.lookup_key("sentry:install-id")

    with patch.object(OptionsStore, "model", model):
        with pytest.raises(TypeError, match="channel must be an UpdateChannel"):
            getattr(store, method)(key, "changed", cast(UpdateChannel, channel))

    assert model.mock_calls == []
    assert cache.mock_calls == []
    assert store._local_cache == {}


@pytest.mark.parametrize("name", ["legacy", "sentry:install-id"])
def test_historical_automator_metadata_remains_readable(name: str) -> None:
    assert ("AUTOMATOR", "automator") in UpdateChannel.choices()
    row = Mock(last_updated_by="automator")
    model = Mock()
    model.objects.get.return_value = row
    cache = Mock()
    store = OptionsStore(cache=cache)
    manager = OptionsManager(store=store)
    manager.register("legacy")
    key = manager.lookup_key(name)

    with patch.object(OptionsStore, "model", model):
        assert store.get_last_update_channel(key) == UpdateChannel("automator")

    assert row.last_updated_by == "automator"
    model.objects.get.assert_called_once_with(key=name)
    assert cache.mock_calls == []


@pytest.mark.parametrize("self_hosted", [True, False])
@pytest.mark.parametrize("setting_name", ["SENTRY_OPTIONS", "SENTRY_DEFAULT_OPTIONS"])
@pytest.mark.parametrize("value", [1234.5, 1234, "", "legacy-timestamp", True, None, [123]])
def test_state_preserves_configured_fallbacks(
    self_hosted: bool, setting_name: str, value: object
) -> None:
    name = "sentry:last_worker_ping"
    store = MagicMock(spec=OptionsStore)
    store.get.return_value = None
    with (
        override_settings(
            SENTRY_SELF_HOSTED=self_hosted,
            SENTRY_OPTIONS={},  # noqa: S011
            SENTRY_DEFAULT_OPTIONS={},
        ),
        override_settings(**{setting_name: {name: value}}),
        patch.object(options.default_manager, "store", store),
    ):
        assert options.get(name) is value
    assert store.set_cache.call_args.args[1] is value


def test_state_missing_value_fallback() -> None:
    store = MagicMock(spec=OptionsStore)
    store.get.return_value = None
    with (
        override_settings(SENTRY_OPTIONS={}, SENTRY_DEFAULT_OPTIONS={}),  # noqa: S011
        patch.object(options.default_manager, "store", store),
    ):
        assert options.get("sentry:last_worker_ping") == ""
    assert store.set_cache.call_args.args[1] == ""


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

    def test_restored_historical_automator_state_preserves_metadata(self) -> None:
        key = options.default_manager.lookup_key("sentry:install-id")
        self.store.set_store(key, "historical-install-id", UpdateChannel.APPLICATION)
        Option.objects.filter(key=key.name).update(last_updated_by="automator")
        row = Option.objects.get(key=key.name)
        original_updated = row.last_updated

        assert self.store.get_store(key) == "historical-install-id"
        assert self.store.get_cache(key) == "historical-install-id"
        assert self.store.get_last_update_channel(key) == UpdateChannel.AUTOMATOR
        with pytest.raises(ValueError, match="automator update channel is retired"):
            self.store.set(key, "changed", UpdateChannel.AUTOMATOR)

        row.refresh_from_db()
        assert row.value == "historical-install-id"
        assert row.last_updated_by == "automator"
        assert row.last_updated == original_updated

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
    def state_store(self):
        with patch.object(options.default_manager, "store", self.store):
            yield

    def test_state_round_trip_uses_existing_storage(self) -> None:
        string_states: list[tuple[str, str]] = [
            ("sentry:system-token", "existing-system-token"),
            ("sentry:install-id", "existing-installation"),
            ("sentry:latest_version", "1.2.3"),
            ("sentry:last_worker_version", "1.2.3"),
            ("sentry:version-configured", "1.2.3"),
        ]
        for self_hosted in [True, False]:
            for name, value in string_states:
                with self.subTest(name=name), self.settings(SENTRY_SELF_HOSTED=self_hosted):
                    key = self.manager.make_key(name, lambda: "", Any, DEFAULT_FLAGS, 0, 0, None)
                    self.store.set_store(key, value, UpdateChannel.UNKNOWN)
                    self.store.delete_cache(key)
                    assert options.get(name) == value
                    assert options.set(name, value)
                    assert Option.objects.get(key=name).value == value
                    assert self.store.get(key) == value
                    assert self.store.cache.get(key.cache_key) == value
                    assert options.delete(name)
                    assert not Option.objects.filter(key=name).exists()
                    assert options.get(name) == ""

    def test_timestamp_state_round_trip_uses_existing_storage(self) -> None:
        name = "sentry:last_worker_ping"
        value = 1234.5
        key = self.manager.make_key(name, lambda: "", Any, DEFAULT_FLAGS, 0, 0, None)
        self.store.set_store(key, value, UpdateChannel.UNKNOWN)
        assert options.get("sentry:last_worker_ping") == value
        assert options.set("sentry:last_worker_ping", value)
        assert Option.objects.get(key=name).value == value
        assert self.store.get(key) == value
        assert self.store.cache.get(key.cache_key) == value
        assert options.delete("sentry:last_worker_ping")
        assert not Option.objects.filter(key=name).exists()
        assert options.get("sentry:last_worker_ping") == ""

    def test_state_preserves_self_hosted_fallbacks(self) -> None:
        with self.settings(
            SENTRY_OPTIONS={"sentry:install-id": "configured-installation"},  # noqa: S011
            SENTRY_DEFAULT_OPTIONS={"sentry:install-id": "default-installation"},
        ):
            assert options.get("sentry:install-id") == "configured-installation"
            options.set("sentry:install-id", "stored-installation")
            assert options.get("sentry:install-id") == "stored-installation"
            options.delete("sentry:install-id")
        with self.settings(SENTRY_DEFAULT_OPTIONS={"sentry:install-id": "default-installation"}):
            assert options.get("sentry:install-id") == "default-installation"

    def test_state_preserves_any_value(self) -> None:
        for value in [123, "123", False, ["legacy"]]:
            for coerce in [True, False]:
                with self.subTest(value=value, coerce=coerce):
                    options.set("sentry:system-token", value, coerce=coerce)
                    assert Option.objects.get(key="sentry:system-token").value == value
                    assert options.get("sentry:system-token") == value

    def test_state_stored_null_uses_configured_fallback(self) -> None:
        with self.settings(
            SENTRY_OPTIONS={"sentry:system-token": "configured-token"}  # noqa: S011
        ):
            options.set("sentry:system-token", None)
            assert Option.objects.get(key="sentry:system-token").value is None
            assert options.get("sentry:system-token") == "configured-token"

    def test_state_uses_normal_channel_permissions(self) -> None:
        assert self.manager.can_update("sentry:system-token", UpdateChannel.UNKNOWN) is None
        assert self.manager.can_update("sentry:system-token", UpdateChannel.CLI) is None
        assert self.manager.can_update("sentry:system-token", UpdateChannel.ADMIN) == (
            options.NotWritableReason.CHANNEL_NOT_ALLOWED
        )
        with pytest.raises(AssertionError, match="cannot be changed at runtime"):
            options.set("sentry:system-token", "value", channel=UpdateChannel.ADMIN)
        options.set("sentry:system-token", "value")
        assert options.get_last_update_channel("sentry:system-token") == UpdateChannel.UNKNOWN
        options.set("sentry:system-token", "changed", channel=UpdateChannel.APPLICATION)
        assert options.get_last_update_channel("sentry:system-token") == UpdateChannel.APPLICATION
