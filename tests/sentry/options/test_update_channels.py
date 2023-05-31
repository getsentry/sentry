from typing import Any, Optional

import pytest
from django.conf import settings
from django.core.cache.backends.locmem import LocMemCache

from sentry.options.manager import (
    DEFAULT_FLAGS,
    FLAG_AUTOMATOR_MODIFIABLE,
    FLAG_CREDENTIAL,
    FLAG_IMMUTABLE,
    FLAG_NOSTORE,
    FLAG_PRIORITIZE_DISK,
    NotWritableReason,
    OptionsManager,
    UpdateChannel,
)
from sentry.options.store import OptionsStore

# Test cases for test_can_update
TEST_CASES = [
    pytest.param(
        "manager",
        DEFAULT_FLAGS,
        None,
        UpdateChannel.UNKNOWN,
        None,
        None,
        id="Legacy set of default option",
    ),
    pytest.param(
        "manager",
        DEFAULT_FLAGS,
        None,
        UpdateChannel.ADMIN,
        NotWritableReason.CHANNEL_NOT_ALLOWED,
        NotWritableReason.CHANNEL_NOT_ALLOWED,
        id="Default option cannot be updated by admin",
    ),
    pytest.param(
        "manager",
        FLAG_CREDENTIAL,
        None,
        UpdateChannel.ADMIN,
        NotWritableReason.CHANNEL_NOT_ALLOWED,
        NotWritableReason.CHANNEL_NOT_ALLOWED,
        id="Credentials cannot be updated by admin",
    ),
    pytest.param(
        "manager",
        DEFAULT_FLAGS,
        None,
        UpdateChannel.AUTOMATOR,
        NotWritableReason.CHANNEL_NOT_ALLOWED,
        NotWritableReason.CHANNEL_NOT_ALLOWED,
        id="Default option cannot be updated by automator",
    ),
    pytest.param(
        "manager",
        FLAG_CREDENTIAL,
        None,
        UpdateChannel.AUTOMATOR,
        NotWritableReason.CHANNEL_NOT_ALLOWED,
        NotWritableReason.CHANNEL_NOT_ALLOWED,
        id="Credentials cannot be updated by automator",
    ),
    pytest.param(
        "manager",
        FLAG_AUTOMATOR_MODIFIABLE,
        UpdateChannel.AUTOMATOR,
        UpdateChannel.AUTOMATOR,
        None,
        None,
        id="Basic options fully owned by automator. Can update",
    ),
    pytest.param(
        "manager",
        FLAG_AUTOMATOR_MODIFIABLE,
        UpdateChannel.CLI,
        UpdateChannel.AUTOMATOR,
        None,
        NotWritableReason.DRIFTED,
        id="Basic options fully owned by automator. Can update",
    ),
    pytest.param(
        "manager",
        FLAG_AUTOMATOR_MODIFIABLE,
        UpdateChannel.AUTOMATOR,
        UpdateChannel.CLI,
        None,
        None,
        id="Basic options set by automator and reset by CLI",
    ),
]


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


@pytest.mark.django_db
@pytest.mark.parametrize(
    "manager_fixture, options_flags, set_channel, check_channel, set_to_same_value_reason, reset_reason",
    TEST_CASES,
)
def test_can_update(
    manager_fixture,
    options_flags: int,
    set_channel: Optional[UpdateChannel],
    check_channel: UpdateChannel,
    set_to_same_value_reason: Optional[NotWritableReason],
    reset_reason: Optional[NotWritableReason],
    request: Any,
) -> None:
    """
    Tests a multi-step update workflow for two options:
    1) check that the provided channel can update the option after registration
    2) updates the option with another channel
    3) check whether the original channel can update it to the same value
    4) check whether the original channel can update it to a different value

    @param set_channel: the channel that sets the option first
    @param check_channel: the channel we call can_update with
    @param set_to_same_value_reason: The NotWritableReason we expect at point 3
    above.
    @param reset_reason: The NotWritableReason we expect at point 4 above.
    """
    manager = request.getfixturevalue(manager_fixture)
    manager.register("option", flags=options_flags)
    manager.register("another_option", flags=DEFAULT_FLAGS)

    reason = manager.can_update("option", "testval", check_channel)
    assert reason == set_to_same_value_reason

    if set_channel:
        manager.set("option", "testval", channel=set_channel)
    else:
        manager.set("option", "testval")

    reason = manager.can_update("option", "testval", check_channel)
    assert reason == set_to_same_value_reason

    reason = manager.can_update("option", "testval2", check_channel)
    assert reason == reset_reason

    manager.unregister("another_option")
    manager.unregister("option")


TEST_CASES_READONLY = [
    pytest.param(
        "manager",
        FLAG_AUTOMATOR_MODIFIABLE,
        False,
        None,
        id="Default option. Not readonly",
    ),
    pytest.param(
        "manager",
        FLAG_IMMUTABLE,
        False,
        NotWritableReason.READONLY,
        id="Immutable option",
    ),
    pytest.param(
        "manager",
        FLAG_NOSTORE,
        False,
        NotWritableReason.READONLY,
        id="Non storable option",
    ),
    pytest.param(
        "manager",
        FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
        False,
        None,
        id="Disk prioritized. Non set",
    ),
    pytest.param(
        "manager",
        FLAG_PRIORITIZE_DISK,
        True,
        NotWritableReason.OPTION_ON_DISK,
        id="Disk prioritized. Set. Non writable",
    ),
]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "manager_fixture, flags, set_settings_val, outcome",
    TEST_CASES_READONLY,
)
def test_non_writable_options(
    manager_fixture,
    flags: int,
    set_settings_val: bool,
    outcome: Optional[NotWritableReason],
    request: Any,
) -> None:
    """
    Test some variations of the `can_update` method when dealing
    with readonly options.
    """
    manager = request.getfixturevalue(manager_fixture)
    manager.register("option", flags=flags)
    if set_settings_val:
        settings.SENTRY_OPTIONS["option"] = "a_value"

    reason_legacy = manager.can_update("option", "val", UpdateChannel.CLI)
    assert reason_legacy == outcome

    reason_automator = manager.can_update("option", "val", UpdateChannel.AUTOMATOR)
    assert reason_automator == outcome


@pytest.mark.django_db
def test_legacy_option(manager) -> None:
    """
    Test the update process of legacy options.
    These options are not registered so we cannot reuse the use cases
    above.
    """
    manager.set("sentry:something", "val")
    assert manager.get("sentry:something") == "val"

    with pytest.raises(AssertionError):
        manager.set("sentry:something_else", "val", channel=UpdateChannel.AUTOMATOR)

    assert (
        manager.can_update("sentry:something_else", "val", channel=UpdateChannel.AUTOMATOR)
        == NotWritableReason.CHANNEL_NOT_ALLOWED
    )
