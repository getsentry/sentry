from functools import cached_property
from unittest.mock import patch

import pytest
from django.conf import settings
from django.core.cache.backends.locmem import LocMemCache
from django.test import override_settings

from sentry.options.manager import (
    DEFAULT_FLAGS,
    FLAG_ADMIN_MODIFIABLE,
    FLAG_AUTOMATOR_MODIFIABLE,
    FLAG_CREDENTIAL,
    FLAG_IMMUTABLE,
    FLAG_NOSTORE,
    FLAG_PRIORITIZE_DISK,
    FLAG_REQUIRED,
    FLAG_STOREONLY,
    OptionsManager,
    UnknownOption,
    UpdateChannel,
)
from sentry.options.store import OptionsStore
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test
from sentry.utils.types import Int, String


@all_silo_test
class OptionsManagerTest(TestCase):
    @cached_property
    def store(self):
        c = LocMemCache("test", {})
        c.clear()
        return OptionsStore(cache=c)

    @cached_property
    def manager(self):
        return OptionsManager(store=self.store)

    @pytest.fixture(autouse=True)
    def register(self):
        default_options = settings.SENTRY_DEFAULT_OPTIONS.copy()
        settings.SENTRY_DEFAULT_OPTIONS = {}
        self.store.flush_local_cache()
        self.manager.register("foo")
        yield
        self.manager.unregister("foo")
        settings.SENTRY_DEFAULT_OPTIONS = default_options

    def test_simple(self):
        assert self.manager.get("foo") == ""

        self.manager.delete("foo")
        with self.settings(SENTRY_OPTIONS={"foo": "bar"}):
            assert self.manager.get("foo") == "bar"

        self.manager.set("foo", "bar")

        assert self.manager.get("foo") == "bar"
        assert self.manager.get_last_update_channel("foo") == UpdateChannel.UNKNOWN

        self.manager.set("foo", "baz", channel=UpdateChannel.CLI)

        assert (
            self.manager.get(
                "foo",
            )
            == "baz"
        )
        assert self.manager.get_last_update_channel("foo") == UpdateChannel.CLI

        self.manager.delete("foo")

        assert self.manager.get("foo") == ""

        assert self.manager.get_last_update_channel("foo") is None

    def test_register(self):
        with pytest.raises(UnknownOption):
            self.manager.get("does-not-exit")

        with pytest.raises(UnknownOption):
            self.manager.set("does-not-exist", "bar")

        self.manager.register("does-not-exist")
        self.manager.get("does-not-exist")  # Just shouldn't raise
        self.manager.unregister("does-not-exist")

        with pytest.raises(UnknownOption):
            self.manager.get("does-not-exist")

        with pytest.raises(AssertionError):
            # This key should already exist, and we can't re-register
            self.manager.register("foo")

        with pytest.raises(TypeError):
            self.manager.register("wrong-type", default=1, type=String)

        with pytest.raises(TypeError):
            self.manager.register("none-type", default=None, type=type(None))

        with pytest.raises(ValueError):
            self.manager.register("bad_flags", flags=FLAG_NOSTORE | FLAG_ADMIN_MODIFIABLE)

        with pytest.raises(ValueError):
            self.manager.register("bad_flags", flags=FLAG_NOSTORE | FLAG_AUTOMATOR_MODIFIABLE)

        with pytest.raises(ValueError):
            self.manager.register("bad_flags", flags=FLAG_CREDENTIAL | FLAG_ADMIN_MODIFIABLE)

        with pytest.raises(ValueError):
            self.manager.register("bad_flags", flags=FLAG_CREDENTIAL | FLAG_AUTOMATOR_MODIFIABLE)

        with pytest.raises(ValueError):
            self.manager.register("bad_flags", flags=FLAG_IMMUTABLE | FLAG_ADMIN_MODIFIABLE)

        with pytest.raises(ValueError):
            self.manager.register("bad_flags", flags=FLAG_IMMUTABLE | FLAG_AUTOMATOR_MODIFIABLE)

        with pytest.raises(ValueError):
            self.manager.register("bad_flags", flags=FLAG_REQUIRED | FLAG_AUTOMATOR_MODIFIABLE)

    def test_coerce(self):
        self.manager.register("some-int", type=Int)

        self.manager.set("some-int", 0)
        assert self.manager.get("some-int") == 0
        self.manager.set("some-int", "0")
        assert self.manager.get("some-int") == 0

        with pytest.raises(TypeError):
            self.manager.set("some-int", "foo")

        with pytest.raises(TypeError):
            self.manager.set("some-int", "0", coerce=False)

    def test_legacy_key(self):
        """
        Allow sentry: prefixed keys without any registration
        """
        # These just shouldn't blow up since they are implicitly registered
        assert self.manager.get("sentry:foo") == ""
        self.manager.set("sentry:foo", "bar")
        assert self.manager.get("sentry:foo") == "bar"
        assert self.manager.delete("sentry:foo")
        assert self.manager.get("sentry:foo") == ""

    def test_types(self):
        self.manager.register("some-int", type=Int, default=0)
        with pytest.raises(TypeError):
            self.manager.set("some-int", "foo")
        self.manager.set("some-int", 1)
        assert self.manager.get("some-int") == 1

    def test_default(self):
        self.manager.register("awesome", default="lol")
        assert settings.SENTRY_DEFAULT_OPTIONS["awesome"] == "lol"
        assert self.manager.get("awesome") == "lol"
        self.manager.set("awesome", "bar")
        assert self.manager.get("awesome") == "bar"
        self.manager.delete("awesome")
        assert self.manager.get("awesome") == "lol"
        self.manager.register("callback", default=lambda: True)
        assert settings.SENTRY_DEFAULT_OPTIONS["callback"] is True
        assert self.manager.get("callback") is True
        self.manager.register("default-type", type=Int)
        assert settings.SENTRY_DEFAULT_OPTIONS["default-type"] == 0
        assert self.manager.get("default-type") == 0

        self.manager.register("some-default")
        with self.settings(SENTRY_OPTIONS={"some-default": "foo"}):
            assert self.manager.get("some-default") == "foo"

        with self.settings(SENTRY_OPTIONS={}, SENTRY_DEFAULT_OPTIONS={"some-default": "foo"}):
            assert self.manager.get("some-default") == "foo"

    def test_flag_immutable(self):
        self.manager.register("immutable", flags=FLAG_IMMUTABLE)
        with pytest.raises(AssertionError):
            self.manager.set("immutable", "thing")
        with pytest.raises(AssertionError):
            self.manager.delete("immutable")

    def test_flag_nostore(self):
        self.manager.register("nostore", flags=FLAG_NOSTORE)
        with pytest.raises(AssertionError):
            self.manager.set("nostore", "thing")

        # Make sure that we don't touch either of the stores
        with patch.object(self.store.cache, "get", side_effect=RuntimeError()):
            with patch.object(self.store.model.objects, "get_queryset", side_effect=RuntimeError()):
                assert self.manager.get("nostore") == ""
                self.store.flush_local_cache()

                with self.settings(SENTRY_OPTIONS={"nostore": "foo"}):
                    assert self.manager.get("nostore") == "foo"
                    self.store.flush_local_cache()

        with pytest.raises(AssertionError):
            self.manager.delete("nostore")

    def test_validate(self):
        with pytest.raises(UnknownOption):
            self.manager.validate({"unknown": ""})

        self.manager.register("unknown")
        self.manager.register("storeonly", flags=FLAG_STOREONLY)
        self.manager.validate({"unknown": ""})

        with pytest.raises(AssertionError):
            self.manager.validate({"storeonly": ""})

        with pytest.raises(TypeError):
            self.manager.validate({"unknown": True})

    def test_flag_storeonly(self):
        self.manager.register("storeonly", flags=FLAG_STOREONLY)
        assert self.manager.get("storeonly") == ""

        with self.settings(SENTRY_OPTIONS={"storeonly": "something-else!"}):
            assert self.manager.get("storeonly") == ""

    def test_drifted(self):
        self.manager.register("option", flags=FLAG_AUTOMATOR_MODIFIABLE)
        # CLI should be able to update anything
        self.manager.set("option", "value", channel=UpdateChannel.CLI)
        assert self.manager.get("option") == "value"

        with pytest.raises(AssertionError):
            self.manager.set("option", "value2", channel=UpdateChannel.AUTOMATOR)

        # Automator should be able to reset the channel of an option
        # By leaving the value as it is.
        self.manager.set("option", "value", channel=UpdateChannel.AUTOMATOR)

    def test_flag_prioritize_disk(self):
        self.manager.register("prioritize_disk", flags=FLAG_PRIORITIZE_DISK)
        assert self.manager.get("prioritize_disk") == ""

        with self.settings(SENTRY_OPTIONS={"prioritize_disk": "something-else!"}):
            with pytest.raises(AssertionError):
                assert self.manager.set("prioritize_disk", "foo")
            assert self.manager.get("prioritize_disk") == "something-else!"

        self.manager.set("prioritize_disk", "foo")
        assert self.manager.get("prioritize_disk") == "foo"

        # Make sure the database value is overridden if defined
        with self.settings(SENTRY_OPTIONS={"prioritize_disk": "something-else!"}):
            assert self.manager.get("prioritize_disk") == "something-else!"

        # Ensure empty values on disk are preferred over DB values (See #14557)
        with self.settings(SENTRY_OPTIONS={"prioritize_disk": ""}):
            assert self.manager.get("prioritize_disk") == ""

        # Ensure None on disk are NOT preferred over DB (See #14557)
        with self.settings(SENTRY_OPTIONS={"prioritize_disk": None}):
            assert self.manager.get("prioritize_disk") == "foo"

    @override_settings(SENTRY_OPTIONS_COMPLAIN_ON_ERRORS=False)
    def test_db_unavailable(self):
        with patch.object(self.store.model.objects, "get_queryset", side_effect=RuntimeError()):
            # we can't update options if the db is unavailable
            with pytest.raises(RuntimeError):
                self.manager.set("foo", "bar")

        self.manager.set("foo", "bar")
        self.store.flush_local_cache()

        with patch.object(self.store.model.objects, "get_queryset", side_effect=RuntimeError()):
            assert self.manager.get("foo") == "bar"
            self.store.flush_local_cache()

            with patch.object(self.store.cache, "get", side_effect=RuntimeError()):
                assert self.manager.get("foo") == ""
                self.store.flush_local_cache()

                with patch.object(self.store.cache, "set", side_effect=RuntimeError()):
                    assert self.manager.get("foo") == ""
                    self.store.flush_local_cache()

    @override_settings(SENTRY_OPTIONS_COMPLAIN_ON_ERRORS=False)
    def test_db_and_cache_unavailable(self):
        self.store.cache.clear()
        self.manager.set("foo", "bar")
        self.store.flush_local_cache()

        with self.settings(SENTRY_OPTIONS={"foo": "baz"}):
            with patch.object(self.store.model.objects, "get_queryset", side_effect=RuntimeError()):
                with patch.object(self.store.cache, "get", side_effect=RuntimeError()):
                    assert self.manager.get("foo") == "baz"
                    self.store.flush_local_cache()

                    with patch.object(self.store.cache, "set", side_effect=RuntimeError()):
                        assert self.manager.get("foo") == "baz"
                        self.store.flush_local_cache()

    @override_settings(SENTRY_OPTIONS_COMPLAIN_ON_ERRORS=False)
    def test_cache_unavailable(self):
        self.manager.set("foo", "bar")
        self.store.flush_local_cache()

        with patch.object(self.store.cache, "get", side_effect=RuntimeError()):
            assert self.manager.get("foo") == "bar"
            self.store.flush_local_cache()

            with patch.object(self.store.cache, "set", side_effect=RuntimeError()):
                assert self.manager.get("foo") == "bar"
                self.store.flush_local_cache()

                # we should still be able to write a new value
                self.manager.set("foo", "baz")
                self.store.flush_local_cache()

        # the cache should be incorrect now, but sync_options will eventually
        # correct the state
        assert self.manager.get("foo") == "bar"
        self.store.flush_local_cache()

        # when the cache poofs, the db will be return the most-true answer
        with patch.object(self.store.cache, "get", side_effect=RuntimeError()):
            assert self.manager.get("foo") == "baz"
            self.store.flush_local_cache()

            with patch.object(self.store.cache, "set", side_effect=RuntimeError()):
                assert self.manager.get("foo") == "baz"
                self.store.flush_local_cache()

    def test_unregister(self):
        with pytest.raises(UnknownOption):
            self.manager.unregister("does-not-exist")

    def test_all(self):
        self.manager.register("bar")

        keys = list(self.manager.all())
        assert {k.name for k in keys} == {"foo", "bar"}

    def test_filter(self):
        self.manager.register("nostore", flags=FLAG_NOSTORE)
        self.manager.register("required", flags=FLAG_REQUIRED)
        self.manager.register("nostorerequired", flags=FLAG_NOSTORE | FLAG_REQUIRED)

        assert list(self.manager.filter()) == list(self.manager.all())

        keys = list(self.manager.filter())
        assert {k.name for k in keys} == {"foo", "nostore", "required", "nostorerequired"}

        keys = list(self.manager.filter(flag=DEFAULT_FLAGS))
        assert {k.name for k in keys} == {"foo"}

        keys = list(self.manager.filter(flag=FLAG_NOSTORE))
        assert {k.name for k in keys} == {"nostore", "nostorerequired"}

        keys = list(self.manager.filter(flag=FLAG_REQUIRED))
        assert {k.name for k in keys} == {"required", "nostorerequired"}

    def test_isset(self):
        self.manager.register("basic")
        assert self.manager.isset("basic") is False

        with patch.object(self.store, "get", side_effect="awesome"):
            assert self.manager.isset("basic") is True

        with self.settings(SENTRY_OPTIONS={"basic": "awesome"}):
            assert self.manager.isset("basic") is True

        self.manager.register("nostore", flags=FLAG_NOSTORE)
        assert self.manager.isset("nostore") is False

        # This shouldn't be affected by the store value since it's NOSTORE
        with patch.object(self.store, "get", side_effect="awesome"):
            assert self.manager.isset("nostore") is False

        with self.settings(SENTRY_OPTIONS={"nostore": "awesome"}):
            assert self.manager.isset("nostore") is True

    def test_flag_checking(self):
        self.manager.register("option", flags=FLAG_NOSTORE)

        opt = self.manager.lookup_key("option")
        assert opt.has_any_flag({FLAG_NOSTORE})
        assert opt.has_any_flag({FLAG_NOSTORE, FLAG_REQUIRED})
        assert not opt.has_any_flag({FLAG_REQUIRED})
