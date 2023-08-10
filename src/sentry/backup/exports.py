from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import NamedTuple

import click
from django.core.serializers import serialize
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models.fields.related import ManyToManyField

from sentry.backup.helpers import EXCLUDED_APPS

UTC_0 = timezone(timedelta(hours=0))


class DatetimeSafeDjangoJSONEncoder(DjangoJSONEncoder):
    """A wrapper around the default `DjangoJSONEncoder` that always retains milliseconds, even when
    their implicit value is `.000`. This is necessary because the ECMA-262 compatible
    `DjangoJSONEncoder` drops these by default."""

    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.astimezone(UTC_0).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        return super().default(obj)


def sort_dependencies():
    """
    Similar to Django's except that we discard the important of natural keys
    when sorting dependencies (i.e. it works without them).
    """
    from django.apps import apps

    from sentry.models.actor import Actor
    from sentry.models.team import Team
    from sentry.models.user import User

    # Process the list of models, and get the list of dependencies
    model_dependencies = []
    models = set()
    for app_config in apps.get_app_configs():
        if app_config.label in EXCLUDED_APPS:
            continue

        model_iterator = app_config.get_models()

        for model in model_iterator:
            models.add(model)
            # Add any explicitly defined dependencies
            if hasattr(model, "natural_key"):
                deps = getattr(model.natural_key, "dependencies", [])
                if deps:
                    deps = [apps.get_model(*d.split(".")) for d in deps]
            else:
                deps = []

            # Now add a dependency for any FK relation with a model that
            # defines a natural key
            for field in model._meta.fields:
                rel_model = getattr(field.remote_field, "model", None)
                if rel_model is not None and rel_model != model:
                    # TODO(hybrid-cloud): actor refactor.
                    # Add cludgy conditional preventing walking actor.team_id, actor.user_id
                    # Which avoids circular imports
                    if model == Actor and (rel_model == Team or rel_model == User):
                        continue

                    deps.append(rel_model)

            # Also add a dependency for any simple M2M relation with a model
            # that defines a natural key.  M2M relations with explicit through
            # models don't count as dependencies.
            many_to_many_fields = [
                field for field in model._meta.get_fields() if isinstance(field, ManyToManyField)
            ]
            for field in many_to_many_fields:
                rel_model = getattr(field.remote_field, "model", None)
                if rel_model is not None and rel_model != model:
                    deps.append(rel_model)

            model_dependencies.append((model, deps))

    model_dependencies.reverse()
    # Now sort the models to ensure that dependencies are met. This
    # is done by repeatedly iterating over the input list of models.
    # If all the dependencies of a given model are in the final list,
    # that model is promoted to the end of the final list. This process
    # continues until the input list is empty, or we do a full iteration
    # over the input models without promoting a model to the final list.
    # If we do a full iteration without a promotion, that means there are
    # circular dependencies in the list.
    model_list = []
    while model_dependencies:
        skipped = []
        changed = False
        while model_dependencies:
            model, deps = model_dependencies.pop()

            # If all of the models in the dependency list are either already
            # on the final model list, or not on the original serialization list,
            # then we've found another model with all it's dependencies satisfied.
            found = True
            for candidate in ((d not in models or d in model_list) for d in deps):
                if not candidate:
                    found = False
            if found:
                model_list.append(model)
                changed = True
            else:
                skipped.append((model, deps))
        if not changed:
            raise RuntimeError(
                "Can't resolve dependencies for %s in serialized app list."
                % ", ".join(
                    f"{model._meta.app_label}.{model._meta.object_name}"
                    for model, deps in sorted(skipped, key=lambda obj: obj[0].__name__)
                )
            )
        model_dependencies = skipped

    return model_list


class OldExportConfig(NamedTuple):
    """While we are migrating to the new backup system, we need to take care not to break the old
    and relatively untested workflows. This model allows us to stub in the old configs."""

    # Do we include models that aren't in `sentry.*` databases, like the native Django ones (sites,
    # sessions, etc)?
    include_non_sentry_models: bool = False

    # A list of models to exclude from the export - eventually we want to deprecate and remove this
    # option.
    excluded_models: set[str] = set()


def exports(dest, old_config: OldExportConfig, indent: int, printer=click.echo):
    """Exports core data for the Sentry installation."""

    def yield_objects():
        # Collate the objects to be serialized.
        for model in sort_dependencies():
            if (
                not getattr(model, "__include_in_export__", old_config.include_non_sentry_models)
                or model.__name__.lower() in old_config.excluded_models
                or model._meta.proxy
            ):
                printer(f">> Skipping model <{model.__name__}>", err=True)
                continue

            queryset = model._base_manager.order_by(model._meta.pk.name)
            yield from queryset.iterator()

    printer(">> Beginning export", err=True)
    serialize(
        "json",
        yield_objects(),
        indent=indent,
        stream=dest,
        use_natural_foreign_keys=True,
        cls=DatetimeSafeDjangoJSONEncoder,
    )
