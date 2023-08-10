from __future__ import annotations

from enum import Enum, auto, unique
from typing import NamedTuple

from django.db import models
from django.db.models.fields.related import ForeignKey, ManyToManyField, OneToOneField

from sentry.backup.helpers import EXCLUDED_APPS
from sentry.silo import SiloMode
from sentry.utils import json


@unique
class ForeignFieldKind(Enum):
    """Kinds of foreign fields that we care about."""

    # Uses our `FlexibleForeignKey` wrapper.
    FlexibleForeignKey = auto()

    # Uses our `HybridCloudForeignKey` wrapper.
    HybridCloudForeignKey = auto()

    # Uses our `OneToOneCascadeDeletes` wrapper.
    OneToOneCascadeDeletes = auto()

    # A naked usage of Django's `ManyToManyField`.
    ManyToManyField = auto()

    # A naked usage of Django's `ForeignKey`.
    DefaultForeignKey = auto()

    # A naked usage of Django's `OneToOneField`.
    DefaultOneToOneField = auto()


class ForeignField(NamedTuple):
    """A field that creates a dependency on another Sentry model."""

    model: models.base.ModelBase
    kind: ForeignFieldKind


class ModelRelations(NamedTuple):
    """What other models does this model depend on, and how?"""

    model: models.base.ModelBase
    relations: dict[str, ForeignField]
    silos: list[SiloMode]

    def flatten(self) -> set[models.base.ModelBase]:
        """Returns a flat list of all related models, omitting the kind of relation they have."""

        return {ff.model for ff in self.relations.values()}


def normalize_model_name(model):
    return f"{model._meta.app_label}.{model._meta.object_name}"


class DependenciesJSONEncoder(json.JSONEncoder):
    """JSON serializer that outputs a detailed serialization of all models included in a
    `ModelRelations`."""

    def default(self, obj):
        if isinstance(obj, models.base.ModelBase):
            return normalize_model_name(obj)
        if isinstance(obj, ForeignFieldKind):
            return obj.name
        if isinstance(obj, SiloMode):
            return obj.name
        if isinstance(obj, set):
            return sorted(list(obj), key=lambda obj: normalize_model_name(obj))
        return super().default(obj)


def dependencies() -> dict[str, ModelRelations]:
    """Produce a dictionary mapping model type definitions to a `ModelDeps` describing their dependencies."""

    from django.apps import apps

    from sentry.db.models.base import ModelSiloLimit
    from sentry.db.models.fields.foreignkey import FlexibleForeignKey
    from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
    from sentry.db.models.fields.onetoone import OneToOneCascadeDeletes
    from sentry.models.actor import Actor
    from sentry.models.team import Team

    # Process the list of models, and get the list of dependencies
    model_dependencies_list: dict[str, ModelRelations] = {}
    for app_config in apps.get_app_configs():
        if app_config.label in EXCLUDED_APPS:
            continue

        model_iterator = app_config.get_models()

        for model in model_iterator:
            relations: dict[str, ForeignField] = dict()

            # Now add a dependency for any FK relation with a model that defines a natural key.
            for field in model._meta.fields:
                rel_model = getattr(field.remote_field, "model", None)
                if rel_model is not None and rel_model != model:
                    # TODO(hybrid-cloud): actor refactor.
                    # Add cludgy conditional preventing walking actor.team_id, actor.user_id
                    # Which avoids circular imports
                    if model == Actor and rel_model == Team:
                        continue

                    if isinstance(field, FlexibleForeignKey):
                        relations[field.name] = ForeignField(
                            model=rel_model,
                            kind=ForeignFieldKind.FlexibleForeignKey,
                        )
                    elif isinstance(field, HybridCloudForeignKey):
                        relations[field.name] = ForeignField(
                            model=rel_model,
                            kind=ForeignFieldKind.HybridCloudForeignKey,
                        )
                    elif isinstance(field, ForeignKey):
                        relations[field.name] = ForeignField(
                            model=rel_model,
                            kind=ForeignFieldKind.DefaultForeignKey,
                        )

            # Also add a dependency for any simple M2M relation.
            many_to_many_fields = [
                field for field in model._meta.get_fields() if isinstance(field, ManyToManyField)
            ]
            for field in many_to_many_fields:
                rel_model = getattr(field.remote_field, "model", None)
                if rel_model is not None and rel_model != model:
                    relations[field.name] = ForeignField(
                        model=rel_model,
                        kind=ForeignFieldKind.ManyToManyField,
                    )

            # Finally, get all simple O2O relations as well.
            one_to_one_fields = [
                field for field in model._meta.get_fields() if isinstance(field, OneToOneField)
            ]
            for field in one_to_one_fields:
                rel_model = getattr(field.remote_field, "model", None)
                if rel_model is not None and rel_model != model:
                    if isinstance(field, OneToOneCascadeDeletes):
                        relations[field.name] = ForeignField(
                            model=rel_model,
                            kind=ForeignFieldKind.OneToOneCascadeDeletes,
                        )
                    elif isinstance(field, OneToOneField):
                        relations[field.name] = ForeignField(
                            model=rel_model,
                            kind=ForeignFieldKind.DefaultOneToOneField,
                        )
                    else:
                        raise RuntimeError("Unknown one to kind")

            model_dependencies_list[normalize_model_name(model)] = ModelRelations(
                model=model,
                relations=relations,
                silos=list(
                    getattr(model._meta, "silo_limit", ModelSiloLimit(SiloMode.MONOLITH)).modes
                ),
            )
    return model_dependencies_list


def sorted_dependencies():
    """Produce a list of model definitions such that, for every item in the list, all of the other models it mentions in its fields and/or natural key (ie, its "dependencies") have already appeared in the list.

    Similar to Django's algorithm except that we discard the importance of natural keys
    when sorting dependencies (ie, it works without them)."""

    model_dependencies_list = list(dependencies().values())
    model_dependencies_list.reverse()
    model_set = {md.model for md in model_dependencies_list}

    # Now sort the models to ensure that dependencies are met. This
    # is done by repeatedly iterating over the input list of models.
    # If all the dependencies of a given model are in the final list,
    # that model is promoted to the end of the final list. This process
    # continues until the input list is empty, or we do a full iteration
    # over the input models without promoting a model to the final list.
    # If we do a full iteration without a promotion, that means there are
    # circular dependencies in the list.
    model_list = []
    while model_dependencies_list:
        skipped = []
        changed = False
        while model_dependencies_list:
            model_deps = model_dependencies_list.pop()
            deps = model_deps.flatten()
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
                    normalize_model_name(m.model)
                    for m in sorted(skipped, key=lambda obj: normalize_model_name(obj))
                )
            )
        model_dependencies_list = skipped

    return model_list
