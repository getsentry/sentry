from typing import Any

import pytest
from django.conf import settings
from django.core.cache.backends.locmem import LocMemCache

from sentry.options.manager import (
    DEFAULT_FLAGS,
    FLAG_CREDENTIAL,
    FLAG_IMMUTABLE,
    FLAG_MODIFIABLE_RATE,
    FLAG_NOSTORE,
    FLAG_PRIORITIZE_DISK,
    FLAG_STOREONLY,
    OptionsManager,
    ReadOnlyReason,
    UpdateChannel,
)
from sentry.options.store import OptionsStore

READONLY_TEST_CASES = [
    pytest.param(
        "manager",
        "opt.default",
        UpdateChannel.UNKNOWN,
        None,
        id="Old path. Default option is writable.",
    )
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
    manager.register("db.only.option", flags=FLAG_STOREONLY)
    manager.register("disk.first", flags=DEFAULT_FLAGS | FLAG_PRIORITIZE_DISK)
    manager.register("default.admin.option", flags=FLAG_MODIFIABLE_RATE)
    manager.register("disk.first.admin.option", flags=FLAG_MODIFIABLE_RATE | FLAG_PRIORITIZE_DISK)
    manager.register("ephemeral.secret.option", flags=FLAG_CREDENTIAL | FLAG_NOSTORE)
    manager.register("standard.secret.option", flags=FLAG_CREDENTIAL)

    yield manager

    manager.unregister("opt.default")
    manager.unregister("immutable.option")
    manager.unregister("file.only.option")
    manager.unregister("db.only.option")
    manager.unregister("disk.first")
    manager.unregister("default.admin.option")
    manager.unregister("disk.first.admin.option")
    manager.unregister("ephemeral.secret.option")
    manager.unregister("standard.secret.option")

    settings.SENTRY_DEFAULT_OPTIONS = default_options


@pytest.mark.parametrize("manager_fixture, key, channel, expected", READONLY_TEST_CASES)
def test_readonly(
    manager_fixture, key: str, channel: UpdateChannel, expected: ReadOnlyReason, request: Any
) -> None:
    manager = request.getfixturevalue(manager_fixture)
    readonly_reason = manager.is_option_readonly(key, channel)
    assert readonly_reason == expected
