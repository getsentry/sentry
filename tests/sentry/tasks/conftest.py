import contextlib
from unittest import mock

import pytest


@pytest.fixture
def register_plugin(request):
    from sentry.plugins.base import plugins

    def inner(globals, cls):
        ctx.enter_context(mock.patch.dict(globals, {cls.__name__: cls}))
        plugins.register(cls)
        request.addfinalizer(lambda: plugins.unregister(cls))

    with contextlib.ExitStack() as ctx:
        yield inner
