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

    def test_get(self):
        #  github-login.require-verified-email: False
        rv = self.invoke("get", "github-login.require-verified-email")
        assert rv.exit_code == 0, rv.output
        assert "False" in rv.output

    def test_bad_get(self):
        rv = self.invoke("get", "testkey3")
        assert rv.exit_code != 0, rv.output
        assert "unknown option" in rv.output

    def test_list(self):
        rv = self.invoke("list")
        assert rv.exit_code == 0, rv.output

    def test_set(self):
        rv = self.invoke("set", "github-login.base-domain", "testVal")
        assert rv.exit_code == 0, rv.output
        assert "Updated key" in rv.output
        rv = self.invoke("get", "github-login.base-domain")
        assert rv.exit_code == 0, rv.output
        assert "testVal" in rv.output

    def test_bad_set(self):
        rv = self.invoke("set", "badKey", "val")
        assert rv.exit_code != 0, rv.output
        assert "unknown option" in rv.output

    def test_delete(self):
        rv = self.invoke("delete", "github-login.api-domain")
        assert rv.exit_code == 0, rv.output
        assert "Deleted key" in rv.output
        rv = self.invoke("get", "github-login.api-domain")

    def test_bad_delete(self):
        rv = self.invoke("delete", "badKey")
        assert rv.exit_code != 0, rv.output
        assert "unknown option" in rv.output

    def test_strict(self):
        rv = self.invoke("strict", "tests/sentry/runner/commands/strict.yaml")
        assert rv.exit_code == 0, rv.output
        assert "Updated key: github-login.base-domain" in rv.output
        assert "Updated key: github-login.extended-permissions" in rv.output
        assert "Deleted key: system.admin-email" in rv.output
        rv = self.invoke("get", "github-login.extended-permissions")
        assert rv.exit_code == 0, rv.output
        assert "['test1', 'test2']" in rv.output

    def test_bad_strict(self):
        rv = self.invoke("strict", "tests/sentry/runner/commands/badstrict.yaml")
        assert rv.exit_code != 0, rv.output
        assert "Error" in rv.output

    def test_patch(self):
        rv = self.invoke("patch", "tests/sentry/runner/commands/patch.yaml")
        assert rv.exit_code == 0, rv.output
        assert "Fetched Key: github-login.api-domain" in rv.output
        assert "Updated key: github-login.api-domain" in rv.output
        assert "Deleted key: relay.transaction-metrics-org-sample-rate" in rv.output

        rv = self.invoke("get", "github-login.api-domain")
        assert rv.exit_code == 0, rv.output
        assert "testing" in rv.output

    def test_bad_patch(self):
        rv = self.invoke("patch", "tests/sentry/runner/commands/badpatch.yaml")
        assert rv.exit_code != 0, rv.output
        assert "Error" in rv.output
