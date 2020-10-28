from __future__ import absolute_import

import pytest


@pytest.fixture
def register_plugin(request, monkeypatch):
    def inner(globals, cls):
        from sentry.plugins.base import plugins

        monkeypatch.setitem(globals, cls.__name__, cls)
        plugins.register(cls)
        request.addfinalizer(lambda: plugins.unregister(cls))

    return inner
