from io import StringIO

import click
from django.apps import apps
from django.core import management, serializers
from django.db import connection

from sentry.runner.decorators import configuration

EXCLUDED_APPS = frozenset(("auth", "contenttypes"))


@click.command(name="import")
@click.argument("src", type=click.File("rb"))
@configuration
def import_(src):
    "Imports data from a Sentry export."

    for obj in serializers.deserialize("json", src, stream=True, use_natural_keys=True):
        if obj.object._meta.app_label not in EXCLUDED_APPS:
            obj.save()

    sequence_reset_sql = StringIO()

    for app in apps.get_app_configs():
        management.call_command(
            "sqlsequencereset", app.label, "--no-color", stdout=sequence_reset_sql
        )

    with connection.cursor() as cursor:
        cursor.execute(sequence_reset_sql.getvalue())


def sort_dependencies():
    """
    Similar to Django's except that we discard the important of natural keys
    when sorting dependencies (i.e. it works without them).
    """
    from django.apps import apps

    # Process the list of models, and get the list of dependencies
    model_dependencies = []
    models = set()
    for app_config in apps.get_app_configs():
        if app_config.label in EXCLUDED_APPS:
            continue

        model_list = app_config.get_models()

        for model in model_list:
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
                if hasattr(field.rel, "to"):
                    rel_model = field.rel.to
                    if rel_model != model:
                        deps.append(rel_model)

            # Also add a dependency for any simple M2M relation with a model
            # that defines a natural key.  M2M relations with explicit through
            # models don't count as dependencies.
            for field in model._meta.many_to_many:
                rel_model = field.rel.to
                if rel_model != model:
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


@click.command()
@click.argument("dest", default="-", type=click.File("w"))
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@click.option(
    "--indent", default=2, help="Number of spaces to indent for the JSON output. (default: 2)"
)
@click.option("--exclude", default=None, help="Models to exclude from export.", metavar="MODELS")
@configuration
def export(dest, silent, indent, exclude):
    "Exports core metadata for the Sentry installation."

    if exclude is None:
        exclude = ()
    else:
        exclude = exclude.lower().split(",")

    def yield_objects():
        # Collate the objects to be serialized.
        for model in sort_dependencies():
            if (
                not getattr(model, "__core__", True)
                or model.__name__.lower() in exclude
                or model._meta.proxy
            ):
                if not silent:
                    click.echo(f">> Skipping model <{model.__name__}>", err=True)
                continue

            queryset = model._base_manager.order_by(model._meta.pk.name)
            yield from queryset.iterator()

    if not silent:
        click.echo(">> Beginning export", err=True)
    serializers.serialize(
        "json", yield_objects(), indent=indent, stream=dest, use_natural_foreign_keys=True
    )
