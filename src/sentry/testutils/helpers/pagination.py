import contextlib
from collections.abc import Generator
from unittest import mock

from sentry.api import base


@contextlib.contextmanager
def override_pagination_limit(n: int) -> Generator[None]:
    with mock.patch.object(base, "PAGINATION_DEFAULT_PER_PAGE", n):
        yield
