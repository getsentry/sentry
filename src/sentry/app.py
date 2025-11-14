from __future__ import annotations
from typing import int

import contextlib
from collections.abc import Generator
from threading import local

from django.http.request import HttpRequest


class State(local):
    def __init__(self) -> None:
        self.request_stack: list[HttpRequest] = []

    @property
    def request(self) -> HttpRequest | None:
        if self.request_stack:
            return self.request_stack[-1]
        else:
            return None

    @contextlib.contextmanager
    def active_request(self, request: HttpRequest) -> Generator[None]:
        self.request_stack.append(request)
        try:
            yield
        finally:
            self.request_stack.pop()


env = State()

# These are backwards incompatible imports that should no longer be used.
# They will be removed to reduce the size of the import graph
from sentry import search, tsdb  # NOQA
from sentry.buffer import backend as buffer  # NOQA
from sentry.digests import backend as digests  # NOQA
from sentry.locks import locks  # NOQA
from sentry.quotas import backend as quotas  # NOQA
from sentry.ratelimits import backend as ratelimiter  # NOQA
from sentry.services.nodestore import backend as nodestore  # NOQA
