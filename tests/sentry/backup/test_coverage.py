from __future__ import annotations

from sentry.db.models import BaseModel
from tests.sentry.backup import get_exportable_final_derivations_of, get_final_derivations_of
from tests.sentry.backup.test_models import TESTED_MODELS

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
