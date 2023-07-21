from __future__ import annotations

from typing import Type

from sentry.db.models import BaseModel
from tests.sentry.backup.test_models import TESTED_MODELS


def get_final_derivations_of(model: Type):
    """A "final" derivation of the given `model` base class is any non-abstract class for the
    "sentry" app with `BaseModel` as an ancestor. Top-level calls to this class should pass in `BaseModel` as the argument."""
    out = set()
    for sub in model.__subclasses__():
        subs = sub.__subclasses__()
        if subs:
            out.update(get_final_derivations_of(sub))
        if not sub._meta.abstract and sub._meta.db_table and sub._meta.app_label == "sentry":
            out.add(sub)
    return out


def get_exportable_final_derivations_of(model: Type):
    """Like `get_final_derivations_of`, except that it further filters the results to include only `__include_in_export__ = True`."""
    return set(
        filter(
            lambda c: getattr(c, "__include_in_export__") is True,
            get_final_derivations_of(model),
        )
    )


ALL_EXPORTABLE_MODELS = {c.__name__ for c in get_exportable_final_derivations_of(BaseModel)}


# Note: this gets checked at runtime, but better to avoid possible runtime errors and catch it early
# in CI.
def test_all_final_derivations_of_django_model_set_included_in_export():
    missing = set(
        filter(
            lambda c: not hasattr(c, "__include_in_export__"),
            get_final_derivations_of(BaseModel),
        )
    )
    assert not missing


def test_exportable_final_derivations_of_django_model_are_tested():
    untested = ALL_EXPORTABLE_MODELS - TESTED_MODELS
    assert not untested
