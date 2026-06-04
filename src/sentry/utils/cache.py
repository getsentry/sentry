from collections.abc import Mapping
from typing import Any, TypeVar

from django.core.cache import cache

__all__ = ["cache", "default_cache", "cache_key_for_event"]

default_cache = cache

T = TypeVar("T")


def cache_key_for_event(data: Mapping[str, Any]) -> str:
    return "e:{}:{}".format(data["event_id"], data["project"])
