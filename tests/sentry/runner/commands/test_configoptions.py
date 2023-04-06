from functools import cached_property

import pytest
from django.core.cache.backends.locmem import LocMemCache

from sentry.options import OptionsManager
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
    def setup(self):
        self.store.flush_local_cache()

    def test_get(self):
        # symbolserver.options: {'url': 'http://127.0.0.1:3000'}
        rv = self.invoke("get", "symbolserver.options")
        assert rv.exit_code == 0, rv.output
        assert "http://127.0.0.1:3000" in rv.output

    def test_badGet(self):
        rv = self.invoke("get", "testkey3")
        assert rv.exit_code == 0, rv.output
        assert "unknown option: testkey3" in rv.output

    def test_strict(self):
        pass
