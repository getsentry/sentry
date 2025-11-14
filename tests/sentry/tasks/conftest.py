import contextlib
from collections.abc import Callable, Generator
from typing import int, Any
from unittest import mock

import pytest


@pytest.fixture
def register_plugin(
    request: pytest.FixtureRequest,
) -> Generator[Callable[[dict[str, Any], type[Any]], None]]:
    from sentry.plugins.base import plugins

    def inner(globals: dict[str, Any], cls: type[Any]) -> None:
        ctx.enter_context(mock.patch.dict(globals, {cls.__name__: cls}))
        plugins.register(cls)
        request.addfinalizer(lambda: plugins.unregister(cls))

    with contextlib.ExitStack() as ctx:
        yield inner
