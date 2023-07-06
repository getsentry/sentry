from __future__ import annotations

from difflib import unified_diff
from io import StringIO
from typing import NewType

import click
from django.apps import apps
from django.core import management, serializers
from django.db import IntegrityError, connection, transaction
from pydantic import PositiveInt

from sentry.runner.decorators import configuration
from sentry.utils.json import JSONData, JSONEncoder, better_default_encoder

EXCLUDED_APPS = frozenset(("auth", "contenttypes"))
INDENT = 2
JSON_PRETTY_PRINTER = JSONEncoder(
    default=better_default_encoder, indent=INDENT, ignore_nan=True, sort_keys=True
)


@click.command(name="import")
@click.argument("src", type=click.File("rb"))
@configuration
def import_(src):
    """CLI command wrapping the `exec_import` functionality."""

    try:
        with transaction.atomic():
            for obj in serializers.deserialize("json", src, stream=True, use_natural_keys=True):
                if obj.object._meta.app_label not in EXCLUDED_APPS:
                    obj.save()
    # For all database integrity errors, let's warn users to follow our
    # recommended backup/restore workflow before reraising exception. Most of
    # these errors come from restoring on a different version of Sentry or not restoring
    # on a clean install.
    except IntegrityError as e:
        warningText = ">> Are you restoring from a backup of the same version of Sentry?\n>> Are you restoring onto a clean database?\n>> If so then this IntegrityError might be our fault, you can open an issue here:\n>> https://github.com/getsentry/sentry/issues/new/choose"
        click.echo(
            warningText,
            err=True,
        )
        raise (e)

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

    from sentry.models.actor import Actor
    from sentry.models.team import Team
    from sentry.models.user import User

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
                if hasattr(field.remote_field, "model"):
                    rel_model = field.remote_field.model
                    if rel_model != model:
                        # TODO(hybrid-cloud): actor refactor.
                        # Add cludgy conditional preventing walking actor.team_id, actor.user_id
                        # Which avoids circular imports
                        if model == Actor and (rel_model == Team or rel_model == User):
                            continue

                        deps.append(rel_model)

            # Also add a dependency for any simple M2M relation with a model
            # that defines a natural key.  M2M relations with explicit through
            # models don't count as dependencies.
            for field in model._meta.many_to_many:
                rel_model = field.remote_field.model
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
    """CLI command wrapping the `exec_export` functionality."""

    if exclude is None:
        exclude = ()
    else:
        exclude = exclude.lower().split(",")

    def yield_objects():
        # Collate the objects to be serialized.
        for model in sort_dependencies():
            if (
                not getattr(model, "__include_in_export__", True)
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


ComparatorName = NewType("ComparatorName", str)
ModelName = NewType("ModelName", str)


# TODO(team-ospo/#155): Figure out if we are going to use `pk` as part of the identifier, or some other kind of sequence number internal to the JSON export instead.
class InstanceID:
    """Every entry in the generated backup JSON file should have a unique model+pk combination, which serves as its identifier."""

    def __init__(self, model: ModelName, pk: PositiveInt):
        self.model = model
        self.pk = pk

    def __eq__(self, other):
        return (
            hasattr(other, "model")
            and self.model == other.model
            and hasattr(other, "pk")
            and self.pk == other.pk
        )

    def __hash__(self):
        return hash((self.model, self.pk))

    def print(self):
        return f'InstanceID(model: "{self.model}", pk: {self.pk})'


class ComparatorFinding:
    """Store all information about a single failed matching between expected and actual output."""

    def __init__(self, name: ComparatorName, on: InstanceID, reason: str | None = ""):
        self.name = name
        self.on = on
        self.reason = reason

    def print(self):
        return f'Finding(\n\tname: "{self.name}",\n\ton: {self.on.print()},\n\treason: {self.reason}\n)'


class ComparatorFindings:
    """A wrapper type for a list of 'ComparatorFinding' which enables pretty-printing in asserts."""

    def __init__(self, findings: list[ComparatorFinding]):
        self.findings = findings

    def append(self, finding: ComparatorFinding):
        self.findings.append(finding)

    def assert_on_findings(self):
        if self.findings:
            assert False, self.print()

    def print(self):
        return "\n".join(map(lambda f: f.print(), self.findings))


# TODO(team-ospo/#155): Move this out of the test suite, and into its own standalone module, since eventually it will be used to compare live JSON as well.
def validate(expect: JSONData, actual: JSONData) -> ComparatorFindings:
    """Ensures that originally imported data correctly matches actual outputted data, and produces a list of reasons why not when it doesn't"""

    def json_lines(obj: JSONData) -> list[str]:
        """Take a JSONData object and pretty-print it as JSON."""

        return JSON_PRETTY_PRINTER.encode(obj).splitlines()

    findings = ComparatorFindings([])
    exp_models = {}
    act_models = {}
    for model in expect:
        id = InstanceID(ModelName(model["model"]), PositiveInt(model["pk"]))
        exp_models[id] = model

    # Ensure that the actual JSON contains no duplicates - we assume that the expected JSON did not.
    for model in actual:
        id = InstanceID(ModelName(model["model"]), PositiveInt(model["pk"]))
        if id in act_models:
            findings.append(ComparatorFinding(ComparatorName("duplicate_entry"), id))
        else:
            act_models[id] = model

    # Report unexpected and missing entries in the actual JSON.
    act_ids = list(act_models)
    exp_ids = list(exp_models)
    for id in act_ids:
        if id not in exp_ids:
            del act_models[id]
            findings.append(ComparatorFinding(ComparatorName("unexpected_entry"), id))
    for id in exp_ids:
        if id not in act_ids:
            del exp_models[id]
            findings.append(ComparatorFinding(ComparatorName("missing_entry"), id))

    # We only perform custom comparisons and JSON diffs on non-duplicate entries that exist in both
    # outputs.
    for id, act in act_models.items():
        exp = exp_models[id]

        # Finally, perform a diff on the remaining JSON.
        diff = list(
            unified_diff(json_lines(exp["fields"]), json_lines(act["fields"]), n=3, lineterm="\n")
        )
        if diff:
            findings.append(
                ComparatorFinding(ComparatorName("json_diff"), id, "\n    " + "\n    ".join(diff))
            )

    findings.assert_on_findings()
    return findings
