from __future__ import annotations

from sentry.backup.dependencies import dependencies, get_model_name
from sentry.backup.helpers import get_exportable_sentry_models
from sentry.backup.scopes import RelocationScope
from sentry.models.actor import Actor
from sentry.models.team import Team
from tests.sentry.backup.test_exhaustive import EXHAUSTIVELY_TESTED, UNIQUENESS_TESTED
from tests.sentry.backup.test_imports import COLLISION_TESTED
from tests.sentry.backup.test_models import DYNAMIC_RELOCATION_SCOPE_TESTED
from tests.sentry.backup.test_releases import RELEASE_TESTED

ALL_EXPORTABLE_MODELS = {get_model_name(c) for c in get_exportable_sentry_models()}


def test_exportable_final_derivations_of_sentry_model_are_dynamic_relocation_tested():
    models_with_multiple_relocation_scopes = {
        get_model_name(c)
        for c in get_exportable_sentry_models()
        if isinstance(getattr(c, "__relocation_scope__", None), set)
    }
    untested = models_with_multiple_relocation_scopes - DYNAMIC_RELOCATION_SCOPE_TESTED
    assert not {str(u) for u in untested}


def test_exportable_final_derivations_of_sentry_model_are_collision_tested():
    deps = dependencies()

    # A model must be tested for collisions if it has at least one `uniques` entry that is composed
    # entirely of fields that are not foreign keys into models in the `User` or `Config` relocation
    # scope. `uniques` that have at least one foreign key into `Organization` or `Global` scoped
    # models are guaranteed to not collide at import-time, since those models are never merged or
    # overwritten on import (ie, they'll always reference a newly inserted foreign key, meaning that
    # they must be unique).
    #
    # TODO(getsentry/team-ospo#188): Edit the above comment to mention `Extension` scope when we add
    # that.
    want_collision_tested = set()
    for model_relations in deps.values():
        # We obviously don't need to collision test models that are excluded from relocation, and
        # `Global` scope assumes a clean database, meaning that collisions are not possible there
        # either.
        if model_relations.relocation_scope in {
            RelocationScope.Excluded,
            RelocationScope.Global,
        }:
            continue

        for unique in model_relations.uniques:
            necessitates_collision_test = True
            for field in unique:
                foreign_field = model_relations.foreign_keys.get(field)
                if foreign_field is not None:
                    foreign_model = deps[get_model_name(foreign_field.model)]
                    if not {RelocationScope.User, RelocationScope.Config}.intersection(
                        foreign_model.get_possible_relocation_scopes()
                    ):
                        necessitates_collision_test = False
                        break

            if necessitates_collision_test:
                want_collision_tested.add(model_relations.model)

    # TODO(hybrid-cloud): Remove after actor refactor completed.
    want_collision_tested.remove(Actor)
    want_collision_tested.remove(Team)

    untested = {get_model_name(m) for m in want_collision_tested} - COLLISION_TESTED
    assert not {str(u) for u in untested}


def test_exportable_final_derivations_of_sentry_model_are_exhaustively_tested():
    untested = ALL_EXPORTABLE_MODELS - EXHAUSTIVELY_TESTED
    assert not {str(u) for u in untested}


def test_exportable_final_derivations_of_sentry_model_are_release_tested_at_head():
    untested = ALL_EXPORTABLE_MODELS - RELEASE_TESTED
    assert not {str(u) for u in untested}


def test_exportable_final_derivations_of_sentry_model_are_uniqueness_tested():
    # No need to uniqueness test global models, since they assume a clean database anyway.
    all_non_global_sentry_models = {
        get_model_name(m)
        for m in get_exportable_sentry_models()
        if not {RelocationScope.Excluded, RelocationScope.Global}.intersection(
            dependencies()[get_model_name(m)].get_possible_relocation_scopes()
        )
    }

    untested = all_non_global_sentry_models - UNIQUENESS_TESTED
    assert not {str(u) for u in untested}
