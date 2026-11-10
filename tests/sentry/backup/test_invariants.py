from __future__ import annotations

from django.db.models.fields.related import ManyToManyField

from sentry.backup.dependencies import (
    ModelRelations,
    NormalizedModelName,
    dependencies,
    get_exportable_sentry_models,
    get_final_derivations_of,
    get_model,
    get_model_name,
)
from sentry.backup.scopes import RelocationScope
from sentry.db.models import BaseModel


# Note: this gets checked at runtime, but better to avoid possible runtime errors and catch it early
# in CI.
def test_all_final_derivations_of_django_model_set_included_in_export() -> None:
    missing = set(
        filter(
            lambda c: not hasattr(c, "__relocation_scope__"),
            get_final_derivations_of(BaseModel),
        )
    )
    assert not missing


def test_all_many_to_many_fields_explicitly_set_through_attribute() -> None:
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


def relocation_scopes_as_set(mr: ModelRelations) -> set[RelocationScope]:
    return mr.relocation_scope if isinstance(mr.relocation_scope, set) else {mr.relocation_scope}


def validate_dependency_scopes(allowed: set[RelocationScope]) -> None:
    deps = dependencies()
    models_being_validated = [
        mr.model
        for mr in filter((lambda mr: relocation_scopes_as_set(mr) & allowed), deps.values())
    ]
    for model in models_being_validated:
        model_name = get_model_name(model)
        own_scopes = relocation_scopes_as_set(deps[model_name])
        for field_name, ff in deps[model_name].foreign_keys.items():
            # Nullable references across scopes are intentional (e.g. `UserOption.project_id` in a
            # `User`-scoped import); import drops only the rows that set them.
            if ff.nullable:
                continue
            dependency_name = get_model_name(ff.model)
            dependency_scopes = relocation_scopes_as_set(deps[dependency_name])
            if not dependency_scopes & allowed:
                raise AssertionError(
                    f"Model `{model_name}` (relocation scopes `{own_scopes}`) has a non-nullable "
                    f"dependency `{field_name}` on model `{dependency_name}` (relocation scopes "
                    f"`{dependency_scopes}`), which is not imported alongside it in `{allowed}`"
                )


def test_exported_models_do_not_depend_on_excluded_models() -> None:
    # Excluded models, such as cross-silo replicas, are never in a backup, so import can't remap
    # a reference to one. Point at the exported source model (for example, with a
    # `HybridCloudForeignKey` to the control-silo original) instead.
    deps = dependencies()
    for model_name, model_relations in deps.items():
        if relocation_scopes_as_set(model_relations) == {RelocationScope.Excluded}:
            continue
        for field_name, ff in model_relations.foreign_keys.items():
            dependency_name = get_model_name(ff.model)
            if relocation_scopes_as_set(deps[dependency_name]) == {RelocationScope.Excluded}:
                raise AssertionError(
                    f"Model `{model_name}` is exported, but its `{field_name}` field depends on "
                    f"`{dependency_name}`, which has `RelocationScope.Excluded`"
                )


def test_user_relocation_scope_validity() -> None:
    # Models with a `User` relocation scope are only allowed to transitively depend on other
    # similarly-scoped models.
    validate_dependency_scopes({RelocationScope.User})


def test_organization_relocation_scope_validity() -> None:
    # Models with an `Organization` or `User` relocation scope are only allowed to transitively
    # depend on other similarly-scoped models.
    validate_dependency_scopes({RelocationScope.Organization, RelocationScope.User})


def test_config_relocation_scope_validity() -> None:
    # Models with a `Config` or `User` relocation scope are only allowed to transitively depend on
    # other similarly-scoped models.
    validate_dependency_scopes({RelocationScope.Config, RelocationScope.User})


def test_all_exported_model_slug_fields_are_unique() -> None:
    # The relocation code assumes that any field whose name ends is "slug" is included in at least
    # one "unique set": that is, either the field itself is marked `unique=True`, or the `slug`
    # field is included in at least one `unique_together` declaration.
    for model_name, model_relations in dependencies().items():
        if model_relations.relocation_scope == RelocationScope.Excluded:
            continue

        if any(field.name == "slug" for field in model_relations.model._meta.get_fields()):
            matched = False
            for fields in model_relations.uniques:
                for field in fields:
                    if field == "slug":
                        matched = True

            if not matched:
                raise AssertionError(
                    f"The model {model_name} has a `slug` field, but this field is neither marked `unique=True` nor included in a `Meta.unique_together` declaration."
                )


def test_merging_models_only_fk_into_user() -> None:
    # We have a mode that allows `User`s to be merged. We assume that related `User*` models
    # `UserIP`, `UserEmail`, and `UserPermission` only reference `User` as a dependency when we do
    # this merging.
    useremail = dependencies()[NormalizedModelName("sentry.useremail")]
    assert len(useremail.foreign_keys) == 1
    assert useremail.foreign_keys["user"].model == get_model(NormalizedModelName("sentry.user"))

    userip = dependencies()[NormalizedModelName("sentry.userip")]
    assert len(userip.foreign_keys) == 1
    assert userip.foreign_keys["user"].model == get_model(NormalizedModelName("sentry.user"))

    userperm = dependencies()[NormalizedModelName("sentry.userpermission")]
    assert len(userperm.foreign_keys) == 1
    assert userperm.foreign_keys["user"].model == get_model(NormalizedModelName("sentry.user"))
