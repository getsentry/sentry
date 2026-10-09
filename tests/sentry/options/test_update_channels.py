from typing import cast
from unittest.mock import Mock, patch

import pytest
from django.conf import settings
from django.core.cache.backends.locmem import LocMemCache
from django.test import override_settings

from sentry.options.manager import (
    DEFAULT_FLAGS,
    FLAG_ADMIN_MODIFIABLE,
    FLAG_CREDENTIAL,
    FLAG_IMMUTABLE,
    FLAG_NOSTORE,
    FLAG_PRIORITIZE_DISK,
    NotWritableReason,
    OptionsManager,
    UnknownOption,
    UpdateChannel,
)
from sentry.options.store import OptionsStore


@pytest.fixture()
def manager():
    """
    Initializes an options storage, an options cache and an options manager
    """

    c = LocMemCache("test", {})
    c.clear()
    store = OptionsStore(cache=c)
    manager = OptionsManager(store=store)

    default_options = settings.SENTRY_DEFAULT_OPTIONS.copy()
    settings.SENTRY_DEFAULT_OPTIONS = {}
    store.flush_local_cache()

    yield manager

    settings.SENTRY_DEFAULT_OPTIONS = default_options


@pytest.mark.parametrize(
    "channel",
    [
        UpdateChannel.UNKNOWN,
        UpdateChannel.APPLICATION,
        UpdateChannel.ADMIN,
        UpdateChannel.CLI,
        UpdateChannel.KILLSWITCH,
    ],
)
def test_writability_requires_no_store_read(manager, channel: UpdateChannel) -> None:
    manager.register("option", flags=FLAG_ADMIN_MODIFIABLE)
    with (
        override_settings(SENTRY_SELF_HOSTED=True),
        patch.object(manager.store, "get", side_effect=AssertionError("writability read storage")),
        patch.object(
            manager.store,
            "get_last_update_channel",
            side_effect=AssertionError("writability read metadata"),
        ),
    ):
        assert manager.can_update("option", channel) is None


@pytest.mark.django_db
@pytest.mark.parametrize(
    "channel",
    [
        UpdateChannel.UNKNOWN,
        UpdateChannel.APPLICATION,
        UpdateChannel.ADMIN,
        UpdateChannel.CLI,
        UpdateChannel.KILLSWITCH,
    ],
)
def test_self_hosted_channels_can_overwrite_stored_values(manager, channel: UpdateChannel) -> None:
    manager.register("option", flags=FLAG_ADMIN_MODIFIABLE)
    with override_settings(SENTRY_SELF_HOSTED=True):
        manager.set("option", "initial", channel=UpdateChannel.APPLICATION)
        assert manager.can_update("option", channel) is None
        manager.set("option", "changed", channel=channel)
        assert manager.get("option") == "changed"
        assert manager.get_last_update_channel("option") == channel


@pytest.mark.parametrize("self_hosted", [False, True])
def test_retired_automator_channel_rejects_manager_writes(self_hosted: bool) -> None:
    store = Mock(spec=OptionsStore)
    manager = OptionsManager(store=store)
    manager.register("option", flags=FLAG_ADMIN_MODIFIABLE)
    channel = UpdateChannel("automator")

    with override_settings(SENTRY_SELF_HOSTED=self_hosted, SENTRY_OPTIONS={}):
        assert manager.can_update("option", channel) == NotWritableReason.CHANNEL_NOT_ALLOWED
        with pytest.raises(ValueError, match="automator update channel is retired"):
            manager.set("option", "changed", channel=channel)

    assert store.mock_calls == []


@pytest.mark.parametrize("channel", ["application", "automator", None])
@pytest.mark.parametrize("self_hosted", [False, True])
def test_invalid_channels_reject_manager_writes(channel: object, self_hosted: bool) -> None:
    store = Mock(spec=OptionsStore)
    manager = OptionsManager(store=store)
    manager.register("option", flags=FLAG_ADMIN_MODIFIABLE)
    invalid_channel = cast(UpdateChannel, channel)

    with override_settings(SENTRY_SELF_HOSTED=self_hosted, SENTRY_OPTIONS={}):
        with pytest.raises(TypeError, match="channel must be an UpdateChannel"):
            manager.can_update("option", invalid_channel)
        with pytest.raises(TypeError, match="channel must be an UpdateChannel"):
            manager.set("option", "changed", channel=invalid_channel)

    assert store.mock_calls == []


@pytest.mark.parametrize(
    ("flags", "disk_values", "channel", "outcome"),
    [
        (FLAG_IMMUTABLE, {}, UpdateChannel.APPLICATION, NotWritableReason.READONLY),
        (FLAG_NOSTORE, {}, UpdateChannel.APPLICATION, NotWritableReason.READONLY),
        (
            FLAG_PRIORITIZE_DISK,
            {"option": "disk-value"},
            UpdateChannel.APPLICATION,
            NotWritableReason.OPTION_ON_DISK,
        ),
        (DEFAULT_FLAGS, {}, UpdateChannel.ADMIN, NotWritableReason.CHANNEL_NOT_ALLOWED),
        (FLAG_CREDENTIAL, {}, UpdateChannel.ADMIN, NotWritableReason.CHANNEL_NOT_ALLOWED),
    ],
)
def test_non_writable_options(
    manager,
    flags: int,
    disk_values: dict[str, str],
    channel: UpdateChannel,
    outcome: NotWritableReason,
) -> None:
    manager.register("option", flags=flags)
    with override_settings(SENTRY_OPTIONS=disk_values):
        assert manager.can_update("option", channel) == outcome
        with pytest.raises(AssertionError):
            manager.set("option", "value", channel=channel)


def test_unregistered_state_option(manager) -> None:
    with pytest.raises(UnknownOption):
        manager.set("sentry:something", "val")
    with pytest.raises(UnknownOption):
        manager.set("getsentry:something", "val", channel=UpdateChannel.APPLICATION)
    with pytest.raises(UnknownOption):
        manager.can_update("sentry:something", channel=UpdateChannel.APPLICATION)
