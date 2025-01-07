from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from enum import Enum, auto, unique
from functools import lru_cache
from typing import NamedTuple

from django.db import models
from django.db.models import Q, UniqueConstraint
from django.db.models.fields.related import ForeignKey, OneToOneField

from sentry.backup.helpers import EXCLUDED_APPS
from sentry.backup.scopes import RelocationScope
from sentry.silo.base import SiloMode
from sentry.utils import json

# We have to be careful when removing fields from our model schemas, since exports created using
# the old-but-still-in-the-support-window versions could have those fields set in the data they
# provide. This dict serves as a map of all fields that have been deleted on HEAD but are still
# valid in at least one of the versions we support. For example, since our current version
# support window is two minor versions back, if we delete a field at version 24.5.N, we must
# include an entry in this map for that field until that version is out of the support window
# (in this case, we can remove shim once version 24.7.0 is released).
#
# NOTE TO FUTURE EDITORS: please keep the `DELETED_FIELDS` dict, and the subsequent `if` clause,
# around even if the dict is empty, to ensure that there is a ready place to pop shims into. For
# each entry in this dict, please leave a TODO comment pointed to a github issue for removing
# the shim, noting in the comment which self-hosted release will trigger the removal.
DELETED_FIELDS: dict[str, set[str]] = {
    # TODO(mark): Safe to remove after july 2024 after self-hosted 24.6.0 is released
    "sentry.team": {"actor"},
    # TODO(mark): Safe to remove after july 2024 after self-hosted 24.6.0 is released
    "sentry.rule": {"owner"},
    # TODO(mark): Safe to remove after july 2024 after self-hosted 24.6.0 is released
    "sentry.alertrule": {"owner"},
    # TODO(mark): Safe to remove after july 2024 after self-hosted 24.6.0 is released
    "sentry.grouphistory": {"actor"},
}

# When models are removed from the application, they will continue to be in exports
# from previous releases. Models in this list are elided from data as imports are processed.
#
# NOTE TO FUTURE EDITORS: please keep the `DELETED_MODELS` set, and the subsequent `if` clause,
# around even if the set is empty, to ensure that there is a ready place to pop shims into. For
# each entry in this set, please leave a TODO comment pointed to a github issue for removing
# the shim, noting in the comment which self-hosted release will trigger the removal.
DELETED_MODELS = {
    # TODO(mark): Safe to remove after july 2024 after self-hosted 24.6.0 is released
    "sentry.actor"
}


class NormalizedModelName:
    """
    A wrapper type that ensures that the contained model name has been properly normalized. A
    "normalized" model name is one that is identical to the name as it appears in an exported JSON
    backup, so a string of the form `{app_label.lower()}.{model_name.lower()}`.
    """

    def __init__(self, model_name: str):
        if "." not in model_name:
            raise TypeError("cannot create NormalizedModelName from invalid input string")
        self.__model_name = model_name.lower()

    def __hash__(self):
        return hash(self.__model_name)

    def __eq__(self, other) -> bool:
        if other is None:
            return False
        if not isinstance(other, self.__class__):
            raise TypeError(
                "NormalizedModelName can only be compared with other NormalizedModelName"
            )
        return self.__model_name == other.__model_name

    def __lt__(self, other) -> bool:
        if not isinstance(other, self.__class__):
            raise TypeError(
                "NormalizedModelName can only be compared with other NormalizedModelName"
            )
        return self.__model_name < other.__model_name

    def __str__(self) -> str:
        return self.__model_name

    def __repr__(self) -> str:
        return f"NormalizedModelName: {self.__model_name}"


# A "root" model is one that is the source of a particular relocation scope - ex, `User` is the root
# of the `User` relocation scope, the model from which all other (non-dangling; see below) models in
# that scope are referenced.
#
# TODO(getsentry/team-ospo#190): We should find a better way to store this information than a magic
# list in this file. We should probably make a field (or method?) on `BaseModel` instead.
_ROOT_MODELS: tuple[NormalizedModelName, ...] = (
    # RelocationScope.User
    NormalizedModelName("sentry.user"),
    # RelocationScope.Organization
    NormalizedModelName("sentry.organization"),
    # RelocationScope.Config
    NormalizedModelName("sentry.controloption"),
    NormalizedModelName("sentry.option"),
    NormalizedModelName("sentry.relay"),
    NormalizedModelName("sentry.relayusage"),
    NormalizedModelName("sentry.userrole"),
    # RelocationScope.Global
    # TODO(getsentry/team-ospo#188): Split out extension scope root models from this list.
    NormalizedModelName("sentry.apiapplication"),
    NormalizedModelName("sentry.integration"),
    NormalizedModelName("sentry.sentryapp"),
)


@unique
class ForeignFieldKind(Enum):
    """Kinds of foreign fields that we care about."""

    # Uses our `FlexibleForeignKey` wrapper.
    FlexibleForeignKey = auto()

    # Uses our `HybridCloudForeignKey` wrapper.
    HybridCloudForeignKey = auto()

    # Uses our `OneToOneCascadeDeletes` wrapper.
    OneToOneCascadeDeletes = auto()

    # A naked usage of Django's `ForeignKey`.
    DefaultForeignKey = auto()

    # A naked usage of Django's `OneToOneField`.
    DefaultOneToOneField = auto()

    # A ForeignKey-like dependency that is opaque to Django because it uses `BoundedBigIntegerField`
    # instead of one of the Django's default relational field types like `ForeignKey`,
    # `OneToOneField`, etc.dd
    ImplicitForeignKey = auto()


class ForeignField(NamedTuple):
    """A field that creates a dependency on another Sentry model."""

    model: type[models.base.Model]
    kind: ForeignFieldKind
    nullable: bool


@dataclass
class ModelRelations:
    """What other models does this model depend on, and how?"""

    # A "dangling" model is one that does not transitively contain a non-nullable `ForeignField`
    # reference to at least one of the `RelocationRootModels` listed above.
    #
    # TODO(getsentry/team-ospo#190): A model may or may not be "dangling" in different
    # `ExportScope`s - for example, a model in `RelocationScope.Organization` may have a single,
    # non-nullable `ForeignField` reference to a root model in `RelocationScope.Config`. This would
    # cause it to be dangling when we do an `ExportScope.Organization` export, but non-dangling if
    # we do an `ExportScope.Global` export. HOWEVER, as best as I can tell, this situation does not
    # actually exist today, so we can ignore this subtlety for now and just us a boolean here.
    dangling: bool | None
    foreign_keys: dict[str, ForeignField]
    model: type[models.base.Model]
    relocation_dependencies: set[type[models.base.Model]]
    relocation_scope: RelocationScope | set[RelocationScope]
    silos: list[SiloMode]
    table_name: str
    uniques: list[frozenset[str]]

    def flatten(self) -> set[type[models.base.Model]]:
        """Returns a flat list of all related models, omitting the kind of relation they have."""

        return {ff.model for ff in self.foreign_keys.values()}

    def get_possible_relocation_scopes(self) -> set[RelocationScope]:
        from sentry.db.models import BaseModel

        if issubclass(self.model, BaseModel):
            return self.model.get_possible_relocation_scopes()
        return set()

    def get_dependencies_for_relocation(self) -> set[type[models.base.Model]]:
        return self.flatten().union(self.relocation_dependencies)

    def get_uniques_without_foreign_keys(self) -> list[frozenset[str]]:
        """
        Gets all unique sets (that is, either standalone fields that are marked `unique=True`, or
        groups of fields listed in `Meta.unique_together`) for a model, as long as those sets do not
        include any fields that are foreign keys. Note that the `id` field would be trivially
        included in this list for every model, and is therefore ignored.
        """

        out = []
        for u in self.uniques:
            # Exclude unique sets that are just {"id"}, since this is true for every model and not
            # very useful when searching for potential collisions.
            if u == {"id"}:
                continue

            has_foreign_key = False
            for field in u:
                if self.foreign_keys.get(field):
                    has_foreign_key = True
                    break

            if not has_foreign_key:
                out.append(u)

        return out


def get_model_name(model: type[models.Model] | models.Model) -> NormalizedModelName:
    return NormalizedModelName(f"{model._meta.app_label}.{model._meta.object_name}")


def get_model(model_name: NormalizedModelName) -> type[models.base.Model] | None:
    """
    Given a standardized model name string, retrieve the matching Sentry model.
    """
    for model in sorted_dependencies():
        if get_model_name(model) == model_name:
            return model
    return None


class DependenciesJSONEncoder(json.JSONEncoder):
    """JSON serializer that outputs a detailed serialization of all models included in a
    `ModelRelations`."""

    def default(self, obj):
        if meta := getattr(obj, "_meta", None):
            return f"{meta.app_label}.{meta.object_name}".lower()
        if isinstance(obj, ModelRelations):
            return obj.__dict__
        if isinstance(obj, ForeignFieldKind):
            return obj.name
        if isinstance(obj, RelocationScope):
            return obj.name
        if isinstance(obj, set) and all(isinstance(rs, RelocationScope) for rs in obj):
            # Order by enum value, which should correspond to `RelocationScope` breadth.
            return sorted(obj, key=lambda obj: obj.value)
        if isinstance(obj, SiloMode):
            return obj.name.lower().capitalize()
        if isinstance(obj, set):
            return sorted(obj, key=lambda obj: get_model_name(obj))
        # JSON serialization of `uniques` values, which are stored in `frozenset`s.
        if isinstance(obj, frozenset):
            return sorted(obj)
        return super().default(obj)


class ImportKind(str, Enum):
    """
    When importing a given model, we may create a new copy of it (`Inserted`), merely re-use an
    `Existing` copy that has the same already-used globally unique identifier (ex: `username` for
    users, `slug` for orgs, etc), or do an `Overwrite` that merges the new data into an existing
    model that already has a `pk` assigned to it. This information can then be saved alongside the
    new `pk` for the model in the `PrimaryKeyMap`, so that models that depend on this one can know
    if they are dealing with a new or re-used model.
    """

    Inserted = "Inserted"
    Existing = "Existing"
    Overwrite = "Overwrite"


class PrimaryKeyMap:
    """
    A map between a primary key in one primary key sequence (like a database) and another (like the
    ordinals in a backup JSON file). As models are moved between databases, their absolute contents
    may stay the same, but their relative identifiers may change. This class allows us to track how
    those relations have been transformed, thereby preserving the model references between one
    another.

    Note that the map assumes that the primary keys in question are integers. In particular, natural
    keys are not supported!
    """

    mapping: dict[str, dict[int, tuple[int, ImportKind, str | None]]]

    def __init__(self):
        self.mapping = defaultdict(dict)

    def get_pk(self, model_name: NormalizedModelName, old: int) -> int | None:
        """
        Get the new, post-mapping primary key from an old primary key.
        """

        pk_map = self.mapping.get(str(model_name))
        if pk_map is None:
            return None

        entry = pk_map.get(old)
        if entry is None:
            return None

        return entry[0]

    def get_pks(self, model_name: NormalizedModelName) -> set[int]:
        """
        Get a list of all of the pks for a specific model.
        """

        return {entry[0] for entry in self.mapping[str(model_name)].items()}

    def get_kind(self, model_name: NormalizedModelName, old: int) -> ImportKind | None:
        """
        Is the mapped entry a newly inserted model, or an already existing one that has been merged
        in?
        """

        pk_map = self.mapping.get(str(model_name))
        if pk_map is None:
            return None

        entry = pk_map.get(old)
        if entry is None:
            return None

        return entry[1]

    def get_slug(self, model_name: NormalizedModelName, old: int) -> str | None:
        """
        Does the mapped entry have a unique slug associated with it?
        """

        pk_map = self.mapping.get(str(model_name))
        if pk_map is None:
            return None

        entry = pk_map.get(old)
        if entry is None:
            return None

        return entry[2]

    def insert(
        self,
        model_name: NormalizedModelName,
        old: int,
        new: int,
        kind: ImportKind,
        slug: str | None = None,
    ) -> None:
        """
        Create a new OLD_PK -> NEW_PK mapping for the given model. Models that contain unique slugs
        (organizations, projects, etc) can optionally store that information as well.
        """

        self.mapping[str(model_name)][old] = (new, kind, slug)

    def extend(self, other: PrimaryKeyMap) -> None:
        """
        Insert all values from another map into this one, without mutating the original map.
        """

        for model_name_str, mappings in other.mapping.items():
            for old_pk, new_entry in mappings.items():
                self.mapping[model_name_str][old_pk] = new_entry

    def partition(
        self, model_names: set[NormalizedModelName], kinds: set[ImportKind] | None = None
    ) -> PrimaryKeyMap:
        """
        Create a new map with only the specified models and kinds retained.
        """

        building = PrimaryKeyMap()
        import_kinds = {k for k in ImportKind} if kinds is None else kinds
        for model_name_str, mappings in self.mapping.items():
            model_name = NormalizedModelName(model_name_str)
            if model_name not in model_names:
                continue

            for old_pk, new_entry in mappings.items():
                (_, import_kind, _) = new_entry
                if import_kind not in import_kinds:
                    continue

                building.mapping[model_name_str][old_pk] = new_entry

        return building


# No arguments, so we lazily cache the result after the first calculation.
@lru_cache(maxsize=1)
def dependencies() -> dict[NormalizedModelName, ModelRelations]:
    """
    Produce a dictionary mapping model type definitions to a `ModelDeps` describing their
    dependencies.
    """

    from django.apps import apps

    from sentry.db.models.base import ModelSiloLimit
    from sentry.db.models.fields.bounded import (
        BoundedBigIntegerField,
        BoundedIntegerField,
        BoundedPositiveIntegerField,
    )
    from sentry.db.models.fields.foreignkey import FlexibleForeignKey
    from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
    from sentry.db.models.fields.onetoone import OneToOneCascadeDeletes

    # Process the list of models, and get the list of dependencies.
    model_dependencies_dict: dict[NormalizedModelName, ModelRelations] = {}
    app_configs = apps.get_app_configs()
    models_from_names = {
        get_model_name(model): model
        for app_config in app_configs
        for model in app_config.get_models()
    }

    for app_config in app_configs:
        if app_config.label in EXCLUDED_APPS:
            continue

        model_iterator = app_config.get_models()

        for model in model_iterator:
            # Ignore some native Django models, since other models don't reference them and we don't
            # really use them for business logic.
            #
            # Also, exclude `getsentry`, since data in those tables should never be backed up or
            # checked.
            if model._meta.app_label in {"sessions", "sites", "test", "getsentry"}:
                continue

            # exclude proxy models since the backup test is already done on a parent if needed
            if model._meta.proxy:
                continue

            foreign_keys: dict[str, ForeignField] = dict()
            uniques: set[frozenset[str]] = {
                frozenset(combo) for combo in model._meta.unique_together
            }
            for constraint in model._meta.constraints:
                if isinstance(constraint, UniqueConstraint):
                    uniques.add(frozenset(constraint.fields))

            # Now add a dependency for any FK relation visible to Django.
            for field in model._meta.get_fields():
                is_nullable = getattr(field, "null", False)
                if field.name != "id" and getattr(field, "unique", False):
                    uniques.add(frozenset({field.name}))

                rel_model = getattr(field.remote_field, "model", None)
                if rel_model is not None and rel_model != model:
                    if isinstance(field, FlexibleForeignKey):
                        foreign_keys[field.name] = ForeignField(
                            model=rel_model,
                            kind=ForeignFieldKind.FlexibleForeignKey,
                            nullable=is_nullable,
                        )
                    elif isinstance(field, ForeignKey):
                        foreign_keys[field.name] = ForeignField(
                            model=rel_model,
                            kind=ForeignFieldKind.DefaultForeignKey,
                            nullable=is_nullable,
                        )
                elif isinstance(field, HybridCloudForeignKey):
                    rel_model = models_from_names[NormalizedModelName(field.foreign_model_name)]
                    foreign_keys[field.name] = ForeignField(
                        model=rel_model,
                        kind=ForeignFieldKind.HybridCloudForeignKey,
                        nullable=is_nullable,
                    )

            # Get all simple O2O relations as well.
            one_to_one_fields = [
                field for field in model._meta.get_fields() if isinstance(field, OneToOneField)
            ]
            for field in one_to_one_fields:
                is_nullable = getattr(field, "null", False)
                if getattr(field, "unique", False):
                    uniques.add(frozenset({field.name}))

                rel_model = getattr(field.remote_field, "model", None)
                if rel_model is not None and rel_model != model:
                    if isinstance(field, OneToOneCascadeDeletes):
                        foreign_keys[field.name] = ForeignField(
                            model=rel_model,
                            kind=ForeignFieldKind.OneToOneCascadeDeletes,
                            nullable=is_nullable,
                        )
                    elif isinstance(field, OneToOneField):
                        foreign_keys[field.name] = ForeignField(
                            model=rel_model,
                            kind=ForeignFieldKind.DefaultOneToOneField,
                            nullable=is_nullable,
                        )
                    else:
                        raise RuntimeError("Unknown one to kind")

            # Use some heuristics to grab numeric-only unlinked dependencies.
            simple_integer_fields = [
                field
                for field in model._meta.get_fields()
                if isinstance(field, BoundedIntegerField)
                or isinstance(field, BoundedBigIntegerField)
                or isinstance(field, BoundedPositiveIntegerField)
            ]
            for field in simple_integer_fields:
                is_nullable = getattr(field, "null", False)
                if getattr(field, "unique", False):
                    uniques.add(frozenset({field.name}))

                # "actor_id", when used as a simple integer field rather than a `ForeignKey` into an
                # `Actor`, refers to a unified but loosely specified means by which to index into a
                # either a `Team` or `User`, before this pattern was formalized by the official
                # `Actor` model. Because of this, we avoid assuming that it is a dependency into
                # `Actor` and just ignore it.
                if field.name.endswith("_id") and field.name != "actor_id":
                    candidate = NormalizedModelName("sentry." + field.name[:-3].replace("_", ""))
                    if candidate and candidate in models_from_names:
                        foreign_keys[field.name] = ForeignField(
                            model=models_from_names[candidate],
                            kind=ForeignFieldKind.ImplicitForeignKey,
                            nullable=is_nullable,
                        )

            model_dependencies_dict[get_model_name(model)] = ModelRelations(
                dangling=None,
                foreign_keys=foreign_keys,
                model=model,
                # We'll fill this in after the entire dictionary is populated.
                relocation_dependencies=set(),
                relocation_scope=getattr(model, "__relocation_scope__", RelocationScope.Excluded),
                silos=list(
                    getattr(model._meta, "silo_limit", ModelSiloLimit(SiloMode.MONOLITH)).modes
                ),
                table_name=model._meta.db_table,
                # Sort the constituent sets alphabetically, so that we get consistent JSON output.
                uniques=sorted(uniques, key=lambda u: ":".join(sorted(u))),
            )

    # Get a flat list of "root" models, then mark all of them as non-dangling.
    for model_name in _ROOT_MODELS:
        model_dependencies_dict[model_name].dangling = False

    # TODO(getsentry/team-ospo#190): In practice, we can treat `AlertRule`'s dependency on
    # `Organization` as non-nullable, so mark it is non-dangling. This is a hack - we should figure
    # out a more rigorous way to deduce this.
    model_dependencies_dict[NormalizedModelName("sentry.alertrule")].dangling = False

    # TODO(getsentry/team-ospo#190): The same is basically true for the remaining models in this
    # list: the schema defines all of their foreign keys as nullable, but since these models have no
    # other models referencing them (ie, they are leaves on our dependency graph), we know that at
    # least one of those nullable relations will be present on every model.
    model_dependencies_dict[NormalizedModelName("sentry.savedsearch")].dangling = False
    model_dependencies_dict[NormalizedModelName("sentry.servicehook")].dangling = False
    model_dependencies_dict[NormalizedModelName("sentry.snubaqueryeventtype")].dangling = False
    model_dependencies_dict[NormalizedModelName("sentry.rulesnooze")].dangling = False

    # Now that all `ModelRelations` have been added to the `model_dependencies_dict`, we can circle
    # back and figure out which ones are actually dangling. We do this by marking all of the root
    # models non-dangling, then traversing from every other model to a (possible) root model
    # recursively. At this point there should be no circular reference chains, so if we encounter
    # them, fail immediately.
    def resolve_dangling(seen: set[NormalizedModelName], model_name: NormalizedModelName) -> bool:
        model_relations = model_dependencies_dict[model_name]
        model_name = get_model_name(model_relations.model)
        if model_name in seen:
            raise RuntimeError(
                f"Circular dependency: {model_name} cannot transitively reference itself"
            )
        if model_relations.relocation_scope == RelocationScope.Excluded:
            model_relations.dangling = False
            return model_relations.dangling
        if model_relations.dangling is not None:
            return model_relations.dangling

        # TODO(getsentry/team-ospo#190): Maybe make it so that `Global` models are never "dangling",
        # since we want to export 100% of models in `ExportScope.Global` anyway?

        seen.add(model_name)

        # If we are able to successfully over all of the foreign keys without encountering a
        # dangling reference, we know that this model is dangling as well.
        model_relations.dangling = True
        for ff in model_relations.foreign_keys.values():
            if not ff.nullable:
                foreign_model_name = get_model_name(ff.model)
                if not resolve_dangling(seen, foreign_model_name):
                    # We only need one non-dangling reference to mark this model as non-dangling as
                    # well.
                    model_relations.dangling = False
                    break

        seen.remove(model_name)
        return model_relations.dangling

    for model_name, model_relations in model_dependencies_dict.items():
        resolve_dangling(set(), model_name)
        model_relations.relocation_dependencies = {
            model_dependencies_dict[NormalizedModelName(rd)].model
            for rd in getattr(model_relations.model, "__relocation_dependencies__", set())
        }

    return model_dependencies_dict


# No arguments, so we lazily cache the result after the first calculation.
@lru_cache(maxsize=1)
def sorted_dependencies() -> list[type[models.base.Model]]:
    """Produce a list of model definitions such that, for every item in the list, all of the other models it mentions in its fields and/or natural key (ie, its "dependencies") have already appeared in the list.

    Similar to Django's algorithm except that we discard the importance of natural keys
    when sorting dependencies (ie, it works without them)."""

    model_dependencies_remaining = sorted(
        dependencies().values(),
        key=lambda mr: get_model_name(mr.model),
        reverse=True,
    )
    model_set = {md.model for md in model_dependencies_remaining}

    # Now sort the models to ensure that dependencies are met. This
    # is done by repeatedly iterating over the input list of models.
    # If all the dependencies of a given model are in the final list,
    # that model is promoted to the end of the final list. This process
    # continues until the input list is empty, or we do a full iteration
    # over the input models without promoting a model to the final list.
    # If we do a full iteration without a promotion, that means there are
    # circular dependencies in the list.
    model_list = []
    while model_dependencies_remaining:
        skipped = []
        changed = False
        while model_dependencies_remaining:
            model_deps = model_dependencies_remaining.pop()
            deps = model_deps.get_dependencies_for_relocation()
            model = model_deps.model

            # If all of the models in the dependency list are either already
            # on the final model list, or not on the original serialization list,
            # then we've found another model with all it's dependencies satisfied.
            found = True
            for candidate in ((d not in model_set or d in model_list) for d in deps):
                if not candidate:
                    found = False
            if found:
                model_list.append(model)
                changed = True
            else:
                skipped.append(model_deps)
        if not changed:
            raise RuntimeError(
                "Can't resolve dependencies for %s in serialized app list."
                % ", ".join(
                    str(get_model_name(m.model))
                    for m in sorted(skipped, key=lambda mr: get_model_name(mr.model))
                )
            )
        model_dependencies_remaining = sorted(skipped, key=lambda mr: get_model_name(mr.model))

    return model_list


# No arguments, so we lazily cache the result after the first calculation.
@lru_cache(maxsize=1)
def reversed_dependencies() -> list[type[models.base.Model]]:
    sorted = list(sorted_dependencies())
    sorted.reverse()
    return sorted


def get_final_derivations_of(model: type[models.base.Model]) -> set[type[models.base.Model]]:
    """
    A "final" derivation of the given `model` base class is any non-abstract class for the "sentry"
    app with `BaseModel` as an ancestor. Top-level calls to this class should pass in `BaseModel` as
    the argument.
    """

    out = set()
    for sub in model.__subclasses__():
        subs = sub.__subclasses__()
        if subs:
            out.update(get_final_derivations_of(sub))
        if not sub._meta.abstract and sub._meta.db_table and sub._meta.app_label == "sentry":
            out.add(sub)
    return out


# No arguments, so we lazily cache the result after the first calculation.
@lru_cache(maxsize=1)
def get_exportable_sentry_models() -> set[type[models.base.Model]]:
    """
    Like `get_final_derivations_of`, except that it further filters the results to include only
    `__relocation_scope__ != RelocationScope.Excluded`.
    """

    from sentry.db.models import BaseModel

    return set(
        filter(
            lambda c: getattr(c, "__relocation_scope__") is not RelocationScope.Excluded,
            get_final_derivations_of(BaseModel),
        )
    )


def merge_users_for_model_in_org(
    model: type[models.base.Model], *, organization_id: int, from_user_id: int, to_user_id: int
) -> None:
    """
    All instances of this model in a certain organization that reference both the organization and
    user in question will be pointed at the new user instead.
    """

    from sentry.models.organization import Organization
    from sentry.users.models.user import User

    model_relations = dependencies()[get_model_name(model)]
    user_refs = {k for k, v in model_relations.foreign_keys.items() if v.model == User}
    org_refs = {
        k if k.endswith("_id") else f"{k}_id"
        for k, v in model_relations.foreign_keys.items()
        if v.model == Organization
    }
    for_this_org = Q(**{field_name: organization_id for field_name in org_refs})
    for user_ref in user_refs:
        q = for_this_org & Q(**{user_ref: from_user_id})
        obj = model.objects.filter(q)
        obj.update(**{user_ref: to_user_id})
