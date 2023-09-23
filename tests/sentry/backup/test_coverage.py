from __future__ import annotations

from sentry.backup.helpers import get_exportable_sentry_models
from tests.sentry.backup.test_exhaustive import EXHAUSTIVELY_TESTED_MODELS
from tests.sentry.backup.test_models import UNIT_TESTED_MODELS

ALL_EXPORTABLE_MODELS = {c.__name__ for c in get_exportable_sentry_models()}


def test_exportable_final_derivations_of_sentry_model_are_unit_tested():
    untested = ALL_EXPORTABLE_MODELS - UNIT_TESTED_MODELS
    assert not untested


def test_exportable_final_derivations_of_sentry_model_are_exhaustively_tested():
    untested = ALL_EXPORTABLE_MODELS - EXHAUSTIVELY_TESTED_MODELS
    assert not untested
