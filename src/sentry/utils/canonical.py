from __future__ import annotations

import copy
from collections.abc import Iterator, Mapping, MutableMapping
from typing import Self, TypeVar

V = TypeVar("V")

__all__ = ("CanonicalKeyDict", "CanonicalKeyView", "get_canonical_name")


LEGACY_KEY_MAPPING = {
    "exception": ("sentry.interfaces.Exception",),
    "logentry": ("sentry.interfaces.Message", "message"),
    "stacktrace": ("sentry.interfaces.Stacktrace",),
    "template": ("sentry.interfaces.Template",),
    "request": ("sentry.interfaces.Http",),
    "user": ("sentry.interfaces.User",),
    "csp": ("sentry.interfaces.Csp",),
    "nel": ("sentry.interfaces.Nel",),
    "breadcrumbs": ("sentry.interfaces.Breadcrumbs",),
    "contexts": ("sentry.interfaces.Contexts",),
    "threads": ("sentry.interfaces.Threads",),
    "debug_meta": ("sentry.interfaces.DebugMeta",),
}


CANONICAL_KEY_MAPPING = {
    "message": ("logentry", "sentry.interfaces.Message"),
    "sentry.interfaces.Exception": ("exception",),
    "sentry.interfaces.Message": ("logentry",),
    "sentry.interfaces.Stacktrace": ("stacktrace",),
    "sentry.interfaces.Template": ("template",),
    "sentry.interfaces.Http": ("request",),
    "sentry.interfaces.User": ("user",),
    "sentry.interfaces.Csp": ("csp",),
    "sentry.interfaces.Nel": ("nel",),
    "sentry.interfaces.Breadcrumbs": ("breadcrumbs",),
    "sentry.interfaces.Contexts": ("contexts",),
    "sentry.interfaces.Threads": ("threads",),
    "sentry.interfaces.DebugMeta": ("debug_meta",),
}


def get_canonical_name(key: str) -> str:
    return CANONICAL_KEY_MAPPING.get(key, (key,))[0]


class CanonicalKeyView(Mapping[str, V]):
    def __init__(self, data: dict[str, V]) -> None:
        self.data = data
        self._len = len({get_canonical_name(key) for key in self.data})

    def copy(self) -> Self:
        return self

    __copy__ = copy

    def __len__(self) -> int:
        return self._len

    def __iter__(self) -> Iterator[str]:
        # Preserve the order of iteration while prioritizing canonical keys
        keys = list(self.data)
        for key in keys:
            canonicals = CANONICAL_KEY_MAPPING.get(key, ())
            if not canonicals:
                yield key
            elif all(k not in keys for k in canonicals):
                yield canonicals[0]

    def __getitem__(self, key: str) -> V:
        canonical = get_canonical_name(key)
        for k in (canonical,) + LEGACY_KEY_MAPPING.get(canonical, ()):
            if k in self.data:
                return self.data[k]

        raise KeyError(key)

    def __repr__(self) -> str:
        return f"CanonicalKeyView({self.data!r})"


class CanonicalKeyDict(MutableMapping[str, V]):
    def __init__(self, data: Mapping[str, V]) -> None:
        self.data: dict[str, V] = {}
        for key, value in data.items():
            canonical_key = get_canonical_name(key)
            if key == canonical_key or canonical_key not in self.data:
                self.data[canonical_key] = value

    def copy(self) -> Self:
        rv = object.__new__(self.__class__)
        rv.data = copy.copy(self.data)
        return rv

    __copy__ = copy

    def __len__(self) -> int:
        return len(self.data)

    def __iter__(self) -> Iterator[str]:
        return iter(self.data)

    def __contains__(self, key: object) -> bool:
        return isinstance(key, str) and get_canonical_name(key) in self.data

    def __getitem__(self, key: str) -> V:
        return self.data[get_canonical_name(key)]

    def __setitem__(self, key: str, value: V) -> None:
        self.data[get_canonical_name(key)] = value

    def __delitem__(self, key: str) -> None:
        del self.data[get_canonical_name(key)]

    def __repr__(self) -> str:
        return f"CanonicalKeyDict({self.data!r})"


CANONICAL_TYPES = (CanonicalKeyDict, CanonicalKeyView)
