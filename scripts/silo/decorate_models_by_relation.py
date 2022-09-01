#!/usr/bin/env sentry exec

from dataclasses import dataclass
from typing import Iterable, Mapping, Type

import django.apps
from django.db.models.fields.related_descriptors import (
    ForwardManyToOneDescriptor,
    ForwardOneToOneDescriptor,
    ManyToManyDescriptor,
    ReverseManyToOneDescriptor,
    ReverseOneToOneDescriptor,
)

from scripts.silo.common import apply_decorators
from sentry.db.models import BaseModel
from sentry.models import Group, Organization, Project, Release

"""
This is an alternative to add_mode_limits.py that uses an algorithmic definition of
the silos and aims for 100% coverage. It examines the fields of model classes and
uses a graph traversal algorithm to find all models that point to the `Organization`
model, either directly or through a number of steps. Those models are tagged for the
customer silo, and all others for the control silo.

Instructions for use:

1. Commit or stash any Git changes in progress.
2. From the Sentry project root, do
     ./scripts/silo/decorate_models_by_relation.py
3. Do `git status` or `git diff` to observe the results. Commit if you're happy.
"""


def get_sentry_model_classes():
    for model_class in django.apps.apps.get_models():
        if model_class._meta.app_label == "sentry":
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


def main():
    sentry_model_classes = frozenset(get_sentry_model_classes())
    search = RelationGraphSearch(
        model_classes=sentry_model_classes,
        target_classes=[Organization],
        naming_conventions={
            # Covers BoundedBigIntegerFields used as soft foreign keys
            "organization_id": Organization,
            "project_id": Project,
            "group_id": Group,
            "release_id": Release,
        },
    )
    customer_classes = search.sweep_for_relations()
    control_classes = sentry_model_classes.difference(customer_classes)

    def filtered_names(classes):
        return (
            (c.__module__, c.__name__)
            for c in classes
            if not hasattr(c._meta, "_ModelSiloLimit__silo_limit")
        )

    apply_decorators(
        "control_silo_model",
        "from sentry.db.models import control_silo_model",
        filtered_names(control_classes),
    )
    apply_decorators(
        "customer_silo_model",
        "from sentry.db.models import customer_silo_model",
        filtered_names(customer_classes),
    )


if __name__ == "__main__":
    main()
