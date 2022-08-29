#!/usr/bin/env sentry exec

import django.apps
from django.db.models.fields.related_descriptors import ForwardManyToOneDescriptor

from scripts.servermode import add_mode_limits
from sentry.models import Organization

"""
This is an alternative to add_mode_limits.py that uses an algorithmic definition of
the silos and aims for 100% coverage. It examines the fields of model classes and
uses a graph traversal algorithm to find all models that point to the `Organization`
model, either directly or through a number of steps. Those models are tagged for the
customer silo, and all others for the control silo.

Instructions for use:

1. Commit or stash any Git changes in progress.
2. From the Sentry project root, do
     ./scripts/servermode/decorate_models_by_relation.py
3. Do `git status` or `git diff` to observe the results. Commit if you're happy.
"""


def get_sentry_model_classes():
    for model_class in django.apps.apps.get_models():
        if model_class._meta.app_label == "sentry":
            yield model_class


def get_related_models(model_class):
    for attr_name in dir(model_class):
        attr = getattr(model_class, attr_name)
        if isinstance(attr, ForwardManyToOneDescriptor):
            yield attr.field.related_model


def sweep_for_references(model_classes, target_classes):
    marked = {c: () for c in target_classes}
    while True:
        new_marks = {}
        for model_class in model_classes:
            if model_class not in marked:
                for related_model in get_related_models(model_class):
                    if related_model in marked:
                        new_marks[model_class] = marked[related_model] + (related_model,)
        if new_marks:
            marked.update(new_marks)
        else:
            return marked.keys()


def main():
    model_classes = set(get_sentry_model_classes())
    customer_classes = sweep_for_references(model_classes, [Organization])
    control_classes = model_classes.difference(customer_classes)

    add_mode_limits.apply_decorators(
        "control_silo_model",
        "from sentry.db.models import control_silo_model",
        ((c.__module__, c.__name__) for c in control_classes),
    )
    add_mode_limits.apply_decorators(
        "customer_silo_model",
        "from sentry.db.models import customer_silo_model",
        ((c.__module__, c.__name__) for c in customer_classes),
    )


if __name__ == "__main__":
    main()
