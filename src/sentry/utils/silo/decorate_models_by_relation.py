from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, Optional, Type

import django.apps
from django.db.models.fields.related_descriptors import (
    ForwardManyToOneDescriptor,
    ForwardOneToOneDescriptor,
    ManyToManyDescriptor,
    ReverseManyToOneDescriptor,
    ReverseOneToOneDescriptor,
)

import sentry.models
from sentry.db.models import BaseModel
from sentry.utils.silo.common import apply_decorators

ALL_SILO_SPECIAL_CASES = frozenset(
    {
        sentry.models.Actor,
        sentry.models.AuditLogEntry,
        sentry.models.File,
        sentry.models.FileBlob,
        sentry.models.FileBlobIndex,
        sentry.models.ScheduledDeletion,
        sentry.models.UserIP,
    }
)


@dataclass
class TargetRelations:
    # Target foreign key relations
    models: Iterable[Type[BaseModel]]

    # Covers BoundedBigIntegerFields used as soft foreign keys
    naming_conventions: Mapping[str, Type[BaseModel]]


def decorate_models_by_relation(
    target_relations: TargetRelations | Iterable[TargetRelations],
    app_label: Optional[str] = "sentry",
    path_name: Optional[str] = "./src/sentry",
):
    model_classes = frozenset(_get_sentry_model_classes(app_label))
    model_classes = model_classes.difference(ALL_SILO_SPECIAL_CASES)

    search = RelationGraphSearch(
        model_classes=model_classes,
        target_classes=target_relations.models,
        naming_conventions=target_relations.naming_conventions,
    )
    region_classes = search.sweep_for_relations()
    control_classes = model_classes.difference(region_classes)

    def to_name_pairs(classes):
        return ((c.__module__, c.__name__) for c in classes)

    apply_decorators(
        "control_silo_model",
        "from sentry.db.models import control_silo_model",
        to_name_pairs(control_classes),
        path_name,
    )
    apply_decorators(
        "region_silo_model",
        "from sentry.db.models import region_silo_model",
        to_name_pairs(region_classes),
        path_name,
    )
    apply_decorators(
        "all_silo_model",
        "from sentry.db.models import all_silo_model",
        to_name_pairs(ALL_SILO_SPECIAL_CASES),
        path_name,
    )


def _get_sentry_model_classes(app_label):
    for model_class in django.apps.apps.get_models():
        if model_class._meta.app_label == app_label:
            yield model_class


@dataclass
class RelationGraphSearch:
    model_classes: Iterable[Type[BaseModel]]
    target_classes: Iterable[Type[BaseModel]]
    naming_conventions: Mapping[str, Type[BaseModel]]

    def get_related_models(self, model_class):
        for attr_name in dir(model_class):
            attr = getattr(model_class, attr_name)
            if isinstance(
                attr,
                (
                    ForwardManyToOneDescriptor,
                    ForwardOneToOneDescriptor,
                    ReverseManyToOneDescriptor,
                    ManyToManyDescriptor,
                ),
            ):
                yield attr.field.related_model
            elif isinstance(attr, ReverseOneToOneDescriptor):
                yield attr.related.related_model
            elif attr_name in self.naming_conventions:
                yield self.naming_conventions[attr_name]

    def sweep_for_relations(self):
        # The keys are the set of classes marked so far. The values show the path through
        # the graph of models, which we don't use but can be cool to look at in debugging.
        marked = {c: (c,) for c in self.target_classes}

        while True:
            new_marks = {}
            for model_class in self.model_classes:
                if model_class in marked:
                    continue
                for related_model in self.get_related_models(model_class):
                    assert isinstance(related_model, type) and issubclass(related_model, BaseModel)
                    if related_model in marked:
                        new_marks[model_class] = marked[related_model] + (related_model,)
            if new_marks:
                marked.update(new_marks)
            else:
                return marked.keys()
