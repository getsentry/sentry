from typing import Any, Optional

import pytest
from django.conf import settings
from django.core.cache.backends.locmem import LocMemCache

from sentry.options.manager import (
    DEFAULT_FLAGS,
    FLAG_AUTOMATOR_MODIFIABLE,
    FLAG_CREDENTIAL,
    FLAG_IMMUTABLE,
    FLAG_MODIFIABLE_RATE,
    FLAG_NOSTORE,
    FLAG_PRIORITIZE_DISK,
    FLAG_STOREONLY,
    NotWritableReason,
    OptionsManager,
    UpdateChannel,
)
from sentry.options.store import OptionsStore

READONLY_TEST_CASES = [
    pytest.param(
        "manager",
        "opt.default",
        "test",
        "test1",
        UpdateChannel.UNKNOWN,
        None,
        id="Write a default flags option with UNKNOWN channel. No check.",
    ),
    pytest.param(
        "manager",
        "immutable.option",
        None,
        "test1",
        UpdateChannel.AUTOMATOR,
        NotWritableReason.READONLY_DEFINITION,
        id="Automator tries to write immutable option.",
    ),
]


@pytest.fixture()
def manager():
    c = LocMemCache("test", {})
    c.clear()
    store = OptionsStore(cache=c)
    manager = OptionsManager(store=store)

    default_options = settings.SENTRY_DEFAULT_OPTIONS.copy()
    settings.SENTRY_DEFAULT_OPTIONS = {}
    store.flush_local_cache()

    manager.register("opt.default", flags=DEFAULT_FLAGS)
    manager.register("immutable.option", flags=FLAG_IMMUTABLE)
    manager.register("file.only.option", flags=FLAG_NOSTORE)
    manager.register("db.only.automator.option", flags=FLAG_STOREONLY | FLAG_AUTOMATOR_MODIFIABLE)
    manager.register("db.only.option", flags=FLAG_STOREONLY)
    manager.register("disk.first", flags=DEFAULT_FLAGS | FLAG_PRIORITIZE_DISK)
    manager.register(
        "default.admin.automator.option", flags=FLAG_MODIFIABLE_RATE | FLAG_AUTOMATOR_MODIFIABLE
    )
    manager.register("default.admin.option", flags=FLAG_MODIFIABLE_RATE)
    manager.register("disk.first.admin.option", flags=FLAG_MODIFIABLE_RATE | FLAG_PRIORITIZE_DISK)
    manager.register(
        "disk.first.admin.automator.option",
        flags=FLAG_MODIFIABLE_RATE | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
    )
    manager.register("ephemeral.secret.option", flags=FLAG_CREDENTIAL | FLAG_NOSTORE)
    manager.register("standard.secret.option", flags=FLAG_CREDENTIAL)

    yield manager

    manager.unregister("opt.default")
    manager.unregister("immutable.option")
    manager.unregister("file.only.option")
    manager.unregister("db.only.option")
    manager.unregister("db.only.automator.option")
    manager.unregister("disk.first")
    manager.unregister("default.admin.option")
    manager.unregister("default.admin.automator.option")
    manager.unregister("disk.first.admin.option")
    manager.unregister("disk.first.admin.automator.option")
    manager.unregister("ephemeral.secret.option")
    manager.unregister("standard.secret.option")

    settings.SENTRY_DEFAULT_OPTIONS = default_options


@pytest.mark.django_db
@pytest.mark.parametrize(
    "manager_fixture, key, set_val, val, channel, expected", READONLY_TEST_CASES
)
def test_can_update(
    manager_fixture,
    key: str,
    set_val: Optional[Any],
    val: Optional[Any],
    channel: UpdateChannel,
    expected: Optional[NotWritableReason],
    request: Any,
) -> None:
    manager = request.getfixturevalue(manager_fixture)
    if set_val is not None:
        manager.set(key, set_val)
    not_writable = manager.can_update(key, val, channel)
    assert not_writable == expected
