from __future__ import annotations

from enum import Enum
from typing import Type

from sentry.backup.scopes import RelocationScope

# Django apps we take care to never import or export from.
EXCLUDED_APPS = frozenset(("auth", "contenttypes", "fixtures"))


def get_final_derivations_of(model: Type) -> set[Type]:
    """A "final" derivation of the given `model` base class is any non-abstract class for the
    "sentry" app with `BaseModel` as an ancestor. Top-level calls to this class should pass in
    `BaseModel` as the argument."""

    out = set()
    for sub in model.__subclasses__():
        subs = sub.__subclasses__()
        if subs:
            out.update(get_final_derivations_of(sub))
        if not sub._meta.abstract and sub._meta.db_table and sub._meta.app_label == "sentry":
            out.add(sub)
    return out


def get_exportable_final_derivations_of(model: Type) -> set[Type]:
    """Like `get_final_derivations_of`, except that it further filters the results to include only
    `__relocation_scope__ != RelocationScope.Excluded`."""

    return set(
        filter(
            lambda c: getattr(c, "__relocation_scope__") is not RelocationScope.Excluded,
            get_final_derivations_of(model),
        )
    )


class Side(Enum):
    left = 1
    right = 2
