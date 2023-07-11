from __future__ import annotations

from threading import local
from typing import Any

from django.http.request import HttpRequest


class State(local):
    request: HttpRequest | None = None
    data: dict[str, Any] = {}


env = State()

from sentry.utils.sdk import RavenShim

raven = client = RavenShim()


# These are backwards incompatible imports that should no longer be used.
# They will be removed to reduce the size of the import graph
from sentry import search, tsdb  # NOQA
from sentry.buffer import backend as buffer  # NOQA
from sentry.digests import backend as digests  # NOQA
from sentry.locks import locks  # NOQA
from sentry.nodestore import backend as nodestore  # NOQA
from sentry.quotas import backend as quotas  # NOQA
from sentry.ratelimits import backend as ratelimiter  # NOQA
