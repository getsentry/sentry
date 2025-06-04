from __future__ import annotations

from django.conf import settings

from sentry.utils.services import LazyServiceWrapper

from .backends.base import Backend
from .backends.dummy import DummyBackend

backend = LazyServiceWrapper(
    Backend, settings.SENTRY_DIGESTS, settings.SENTRY_DIGESTS_OPTIONS, (DummyBackend,)
)
backend.expose(locals())

OPTIONS = frozenset(("increment_delay", "maximum_delay", "minimum_delay"))


def get_option_key(plugin: str, option: str) -> str:
    assert option in OPTIONS
    return f"digests:{plugin}:{option}"
