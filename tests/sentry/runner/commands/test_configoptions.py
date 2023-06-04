from functools import cached_property

import pytest
from django.core.cache.backends.locmem import LocMemCache

from sentry.options.manager import OptionsManager
from sentry.options.store import OptionsStore
from sentry.runner.commands.configoptions import configoptions
from sentry.testutils import CliTestCase


class ConfigOptionsTest(CliTestCase):
    command = configoptions

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
        self.store.flush_local_cache()

    def test_strict(self):
        pass
        # rv = self.invoke("strict", "tests/sentry/runner/commands/strict.yaml")
        # assert rv.exit_code == 0, rv.output
        # assert "Updated key: github-login.base-domain" in rv.output
        # assert "Updated key: github-login.extended-permissions" in rv.output
        # assert "Deleted key: system.admin-email" in rv.output
        # rv = self.invoke("get", "github-login.extended-permissions")
        # assert rv.exit_code == 0, rv.output
        # assert "['test1', 'test2']" in rv.output

        # self.invoke("delete", "github-login.base-domain")
        # self.invoke("delete", "github-login.extended-permissions")
        # self.invoke("delete", "symbolserver.options")

    def test_bad_strict(self):
        pass
        # rv = self.invoke("strict", "tests/sentry/runner/commands/badstrict.yaml")
        # assert rv.exit_code != 0, rv.output

    def test_patch(self):
        rv = self.invoke("patch", "tests/sentry/runner/commands/patch.yaml")
        assert rv.exit_code == 0, rv.output
        assert "Fetched Key: github-login.api-domain" in rv.output
        assert "Updated key: github-login.api-domain" in rv.output
        assert "Deleted key: symbolserver.options" in rv.output

        # rv = self.invoke("get", "github-login.api-domain")
        # assert rv.exit_code == 0, rv.output
        # assert "testing" in rv.output
        # self.invoke("delete", "github-login.api-domain")
        self.invoke("nodedata.cache-sample-rate")

    def test_bad_patch(self):
        rv = self.invoke("patch", "tests/sentry/runner/commands/badpatch.yaml")
        assert rv.exit_code != 0, rv.output
