from __future__ import annotations

from sentry.backup.dependencies import get_model_name
from sentry.backup.helpers import get_exportable_sentry_models
from tests.sentry.backup.test_exhaustive import EXHAUSTIVELY_TESTED
from tests.sentry.backup.test_models import DYNAMIC_RELOCATION_TESTED, UNIT_TESTED

ALL_EXPORTABLE_MODELS = {get_model_name(c) for c in get_exportable_sentry_models()}


def test_exportable_final_derivations_of_sentry_model_are_unit_tested():
    untested = ALL_EXPORTABLE_MODELS - UNIT_TESTED
    assert not untested


def test_exportable_final_derivations_of_sentry_model_are_dynamic_relocation_tested():
    models_with_multiple_relocation_scopes = {
        get_model_name(c)
        for c in get_exportable_sentry_models()
        if isinstance(getattr(c, "__relocation_scope__", None), set)
    }
    untested = models_with_multiple_relocation_scopes - DYNAMIC_RELOCATION_TESTED
    assert not untested


def test_exportable_final_derivations_of_sentry_model_are_exhaustively_tested():
    untested = ALL_EXPORTABLE_MODELS - EXHAUSTIVELY_TESTED
    assert not untested


# TODO(getsentry/team-ospo#201): UNIQUENESS_TESTED would not pass yet - add coverage once it does.
