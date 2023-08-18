from __future__ import annotations

from sentry.backup.helpers import get_exportable_final_derivations_of
from sentry.db.models import BaseModel
from tests.sentry.backup.test_models import UNIT_TESTED_MODELS
from tests.sentry.backup.test_release import RELEASE_TESTED_MODELS

ALL_EXPORTABLE_MODELS = {c.__name__ for c in get_exportable_final_derivations_of(BaseModel)}


def test_exportable_final_derivations_of_django_model_are_unit_tested():
    untested = ALL_EXPORTABLE_MODELS - UNIT_TESTED_MODELS
    assert not untested


def test_exportable_final_derivations_of_django_model_are_release_tested():
    untested = ALL_EXPORTABLE_MODELS - RELEASE_TESTED_MODELS
    assert not untested
