from __future__ import annotations

from sentry.backup.dependencies import dependencies, get_exportable_sentry_models, get_model_name
from sentry.backup.scopes import RelocationScope
from sentry.models.activity import Activity
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupbookmark import GroupBookmark
from sentry.models.groupseen import GroupSeen
from sentry.models.groupshare import GroupShare
from sentry.models.groupsubscription import GroupSubscription
from sentry.users.models.user import User
from tests.sentry.backup.test_exhaustive import EXHAUSTIVELY_TESTED, UNIQUENESS_TESTED
from tests.sentry.backup.test_imports import COLLISION_TESTED
from tests.sentry.backup.test_models import DYNAMIC_RELOCATION_SCOPE_TESTED
from tests.sentry.users.models.test_user import ORG_MEMBER_MERGE_TESTED

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

        for unique_set in model_relations.uniques:
            necessitates_collision_test = True
            for field in unique_set:
                foreign_field = model_relations.foreign_keys.get(field)

                # For cases where the foreign field is named directly (ex: "foo") but the unique
                # constraint chose to name it as the underlying id (ex: "foo_id"), try to recover.
                if foreign_field is None and field.endswith("_id"):
                    foreign_field = model_relations.foreign_keys.get(field[:-3])

                # We have a foreign field - if it is in the `Organization` or `Global` scope, we can
                # ensure that it will be unique for every import, thereby guaranteed that this
                # `unique_set` does not necessitate a collision test (though other `unique_set`s
                # still might!).
                if foreign_field is not None:
                    foreign_model_relations = deps[get_model_name(foreign_field.model)]
                    if not {RelocationScope.User, RelocationScope.Config}.intersection(
                        foreign_model_relations.get_possible_relocation_scopes()
                    ):
                        necessitates_collision_test = False
                        break

            if necessitates_collision_test:
                want_collision_tested.add(model_relations.model)

    untested = {get_model_name(m) for m in want_collision_tested} - COLLISION_TESTED
    assert not {
        str(u) for u in untested
    }, "The aforementioned models are not covered in the `COLLISION` backup tests; please go to `tests/sentry/backup/test_exhaustive.py` and make sure at least one test in the suite contains covers each of the missing models."


def test_exportable_final_derivations_of_sentry_model_are_exhaustively_tested():
    untested = ALL_EXPORTABLE_MODELS - EXHAUSTIVELY_TESTED
    assert not {
        str(u) for u in untested
    }, "The aforementioned models are not covered in the backup tests; please go to `tests/sentry/backup/test_exhaustive.py` and make sure at least one test in the suite contains covers each of the missing models."


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
    assert not {
        str(u) for u in untested
    }, "The aforementioned models are not covered in the `UNIQUENESS` backup tests; please go to `tests/sentry/backup/test_exhaustive.py` and make sure at least one test in the suite contains covers each of the missing models."


def test_all_eligible_organization_scoped_models_tested_for_user_merge():
    all_org_scope_models_that_reference_user = set()
    for model in get_exportable_sentry_models():
        model_name = get_model_name(model)
        model_relations = dependencies()[model_name]
        possible_relocation_scopes = model_relations.get_possible_relocation_scopes()
        if RelocationScope.Organization not in possible_relocation_scopes:
            continue
        for foreign_field in model_relations.foreign_keys.values():
            if foreign_field.model == User:
                all_org_scope_models_that_reference_user.add(model_name)
                break

    # Manually add some models that are currently excluded from exports, but still included in user
    # merging.
    all_org_scope_models_that_reference_user |= {
        get_model_name(m)
        for m in {
            Activity,
            GroupAssignee,
            GroupBookmark,
            GroupSeen,
            GroupShare,
            GroupSubscription,
        }
    }

    untested = all_org_scope_models_that_reference_user - ORG_MEMBER_MERGE_TESTED
    assert not {
        str(u) for u in untested
    }, "The aforementioned models are not covered in the `ORG_MEMBER_MERGE` backup tests; please go to `tests/sentry/models/test_user.py::UserMergeToTest` and make sure at least one test in the suite contains covers each of the missing models."
