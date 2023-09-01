from __future__ import annotations

from django.db.models.fields.related import ManyToManyField

from sentry.backup.dependencies import dependencies, normalize_model_name
from sentry.backup.helpers import get_exportable_sentry_models, get_final_derivations_of
from sentry.backup.scopes import RelocationScope
from sentry.db.models import BaseModel


# Note: this gets checked at runtime, but better to avoid possible runtime errors and catch it early
# in CI.
def test_all_final_derivations_of_django_model_set_included_in_export():
    missing = set(
        filter(
            lambda c: not hasattr(c, "__relocation_scope__"),
            get_final_derivations_of(BaseModel),
        )
    )
    assert not missing


def test_all_many_to_many_fields_explicitly_set_through_attribute():
    # Make sure we are visiting the field definitions correctly.
    visited = 0

    for model in get_exportable_sentry_models():
        many_to_many_fields = [
            field for field in model._meta.get_fields() if isinstance(field, ManyToManyField)
        ]
        for field in many_to_many_fields:
            if field.remote_field.through is not None and field.remote_field.through._meta:
                if field.remote_field.through._meta.auto_created:
                    raise AssertionError(
                        f"""{model!r} model has a `ManyToManyField` field, "{field.name}", that does not set an explicit `through=...` junction model."""
                    )
                else:
                    visited += 1

    assert visited > 0


def validate_dependency_scopes(allowed: set[RelocationScope]):
    deps = dependencies()
    models = [mr.model for mr in filter((lambda mr: mr.relocation_scope in allowed), deps.values())]
    for model in models:
        model_name = normalize_model_name(model)
        own_scope = deps[model_name].relocation_scope
        for ff in deps[model_name].foreign_keys.values():
            dependency_name = normalize_model_name(ff.model)
            dependency_scope = deps[dependency_name].relocation_scope
            if dependency_scope not in allowed:
                AssertionError(
                    f"Model `{model_name}`, which has a relocation scope of `{own_scope.name}`, has a dependency on model `{dependency_name}`, which has the disallowed relocation scope of `{dependency_scope.name}`"
                )


def test_user_relocation_scope_validity():
    # Models with a `User` relocation scope are only allowed to transitively depend on other
    # similarly-scoped models.
    validate_dependency_scopes({RelocationScope.User})


def test_organization_relocation_scope_validity():
    # Models with an `Organization` or `User` relocation scope are only allowed to transitively
    # depend on other similarly-scoped models.
    validate_dependency_scopes({RelocationScope.Organization, RelocationScope.User})
