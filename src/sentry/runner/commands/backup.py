from __future__ import annotations

from abc import ABC, abstractmethod
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from difflib import unified_diff
from io import StringIO
from typing import Dict, List, NamedTuple, NewType

import click
from dateutil import parser
from django.apps import apps
from django.core import management, serializers
from django.core.serializers import serialize
from django.core.serializers.json import DjangoJSONEncoder
from django.db import IntegrityError, connection, transaction

from sentry.runner.decorators import configuration
from sentry.utils.json import JSONData, JSONEncoder, better_default_encoder

EXCLUDED_APPS = frozenset(("auth", "contenttypes"))
JSON_PRETTY_PRINTER = JSONEncoder(
    default=better_default_encoder, indent=2, ignore_nan=True, sort_keys=True
)

ComparatorKind = NewType("ComparatorKind", str)


# TODO(team-ospo/#155): Figure out if we are going to use `pk` as part of the identifier, or some other kind of sequence number internal to the JSON export instead.
class InstanceID(NamedTuple):
    """Every entry in the generated backup JSON file should have a unique model+pk combination,
    which serves as its identifier."""

    model: str
    pk: int

    def pretty(self) -> str:
        return f"InstanceID(model: {self.model!r}, pk: {self.pk})"


class ComparatorFinding(NamedTuple):
    """Store all information about a single failed matching between expected and actual output."""

    kind: ComparatorKind
    on: InstanceID
    reason: str = ""

    def pretty(self) -> str:
        return f"Finding(\n\tkind: {self.kind!r},\n\ton: {self.on.pretty()},\n\treason: {self.reason}\n)"


class ComparatorFindings:
    """A wrapper type for a list of 'ComparatorFinding' which enables pretty-printing in asserts."""

    def __init__(self, findings: list[ComparatorFinding]):
        self.findings = findings

    def append(self, finding: ComparatorFinding) -> None:
        self.findings.append(finding)

    def pretty(self) -> str:
        return "\n".join(f.pretty() for f in self.findings)


class JSONScrubbingComparator(ABC):
    """An abstract class that compares and then scrubs some set of fields that, by a more nuanced
    definition than mere strict byte-for-byte equality, are expected to maintain some relation on
    otherwise equivalent JSON instances of the same model.

    Each class inheriting from `JSONScrubbingComparator` should override the abstract `compare`
    method with its own comparison logic. The `scrub` method is universal (it merely moves the
    compared fields from the `fields` dictionary to the non-diffed `scrubbed` dictionary).

    If multiple comparators are used sequentially on a single model (see the `SCRUBBING_COMPARATORS`
    dict below for specific mappings), all of the `compare(...)` methods are called before any of
    the `scrub(...)` methods are. This ensures that comparators that touch the same fields do not
    have their inputs mangled by one another."""

    def __init__(self, fields: list[str]):
        self.fields = fields

    def check(self, side: str, data: JSONData) -> None:
        """Ensure that we have received valid JSON data at runtime."""

        if "model" not in data or not isinstance(data["model"], str):
            raise RuntimeError(f"The {side} input must have a `model` string assigned to it.")
        if "pk" not in data or not isinstance(data["pk"], int):
            raise RuntimeError(f"The {side} input must have a numerical `pk` entry.")
        if "fields" not in data or not isinstance(data["fields"], dict):
            raise RuntimeError(f"The {side} input must have a `fields` dictionary.")

    @abstractmethod
    def compare(self, on: InstanceID, left: JSONData, right: JSONData) -> ComparatorFinding | None:
        """An abstract method signature, to be implemented by inheriting classes with their own
        comparison logic. Implementations of this method MUST take care not to mutate the method's
        inputs!"""

        pass

    def scrub(self, on: InstanceID, left: JSONData, right: JSONData) -> None:
        """Removes all of the fields compared by this comparator from the `fields` dict, so that the
        remaining fields may be compared for equality.

        Parameters:
        - on: An `InstanceID` that must be shared by both versions of the JSON model being
            compared.
        - left: One of the models being compared (usually the "before") version.
        - right: The other model it is being compared against (usually the "after" or
            post-processed version).
        """

        self.check("left", left)
        self.check("right", right)
        if "scrubbed" not in left:
            left["scrubbed"] = {}
        if "scrubbed" not in right:
            right["scrubbed"] = {}
        for field in self.fields:
            del left["fields"][field]
            left["scrubbed"][f"{self.get_kind()}::{field}"] = True
            del right["fields"][field]
            right["scrubbed"][f"{self.get_kind()}::{field}"] = True

    def get_kind(self) -> ComparatorKind:
        """A unique identifier for this particular derivation of JSONScrubbingComparator, which will
        be bubbled up in ComparatorFindings when they are generated."""

        return self.__class__.__name__


class DateUpdatedComparator(JSONScrubbingComparator):
    """Comparator that ensures that the specified field's value on the right input is an ISO-8601
    date that is greater than (ie, occurs after) the specified field's left input."""

    def __init__(self, field: str):
        super().__init__([field])
        self.field = field

    def compare(self, on: InstanceID, left: JSONData, right: JSONData) -> ComparatorFinding | None:
        left_date_updated = left["fields"][self.field]
        right_date_updated = right["fields"][self.field]
        if parser.parse(left_date_updated) > parser.parse(right_date_updated):
            return ComparatorFinding(
                kind=self.get_kind(),
                on=on,
                reason=f"""the left date_updated value on `{on}` ({left_date_updated}) was not less
                than or equal to the right ({right_date_updated})""",
            )


ComparatorList = List[JSONScrubbingComparator]
ComparatorMap = Dict[str, ComparatorList]
DEFAULT_COMPARATORS: ComparatorMap = {
    "sentry.alertrule": [DateUpdatedComparator("date_modified")],
    "sentry.incidenttrigger": [DateUpdatedComparator("date_modified")],
    "sentry.querysubscription": [DateUpdatedComparator("date_updated")],
    "sentry.userrole": [DateUpdatedComparator("date_updated")],
    "sentry.userroleuser": [DateUpdatedComparator("date_updated")],
}


def validate(
    expect: JSONData,
    actual: JSONData,
    comparators: ComparatorMap = DEFAULT_COMPARATORS,
) -> ComparatorFindings:
    """Ensures that originally imported data correctly matches actual outputted data, and produces a
    list of reasons why not when it doesn't.
    """

    def json_lines(obj: JSONData) -> list[str]:
        """Take a JSONData object and pretty-print it as JSON."""

        return JSON_PRETTY_PRINTER.encode(obj).splitlines()

    findings = ComparatorFindings([])
    exp_models = {}
    act_models = {}
    for model in expect:
        id = InstanceID(model["model"], model["pk"])
        exp_models[id] = model

    # Because we may be scrubbing data from the objects as we compare them, we may (optionally) make
    # deep copies to start to avoid potentially mangling the input data.
    expect = deepcopy(expect)
    actual = deepcopy(actual)

    # Ensure that the actual JSON contains no duplicates - we assume that the expected JSON did not.
    for model in actual:
        id = InstanceID(model["model"], model["pk"])
        if id in act_models:
            findings.append(ComparatorFinding("DuplicateEntry", id))
        else:
            act_models[id] = model

    # Report unexpected and missing entries in the actual JSON.
    extra = sorted(act_models.keys() - exp_models.keys())
    missing = sorted(exp_models.keys() - act_models.keys())
    for id in extra:
        del act_models[id]
        findings.append(ComparatorFinding("UnexpectedEntry", id))
    for id in missing:
        del exp_models[id]
        findings.append(ComparatorFinding("MissingEntry", id))

    # We only perform custom comparisons and JSON diffs on non-duplicate entries that exist in both
    # outputs.
    for id, act in act_models.items():
        exp = exp_models[id]

        # Try comparators applicable for this specific model.
        if id.model in comparators:
            # We take care to run ALL of the `compare()` methods on each comparator before calling
            # any `scrub()` methods. This ensures tha, in cases where a single model uses multiple
            # comparators that touch the same fields, one comparator does not accidentally scrub the
            # inputs for its follower. If `compare()` functions are well-behaved (that is, they
            # don't mutate their inputs), this should be sufficient to ensure that the order in
            # which comparators are applied does not change the final output.
            for cmp in comparators[id.model]:
                res = cmp.compare(id, exp, act)
                if res:
                    findings.append(ComparatorFinding(cmp.get_kind(), id, res))
            for cmp in comparators[id.model]:
                cmp.scrub(id, exp, act)

        # Finally, perform a diff on the remaining JSON.
        diff = list(unified_diff(json_lines(exp["fields"]), json_lines(act["fields"]), n=3))
        if diff:
            findings.append(ComparatorFinding("UnequalJSON", id, "\n    " + "\n    ".join(diff)))

    return findings


@click.command(name="import")
@click.argument("src", type=click.File("rb"))
@configuration
def import_(src):
    """CLI command wrapping the `exec_import` functionality."""

    try:
        # Import / export only works in monolith mode with a consolidated db.
        with transaction.atomic("default"):
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


UTC_0 = timezone(timedelta(hours=0))


class DatetimeSafeDjangoJSONEncoder(DjangoJSONEncoder):
    """A wrapper around the default `DjangoJSONEncoder` that always retains milliseconds, even when
    their implicit value is `.000`. This is necessary because the ECMA-262 compatible
    `DjangoJSONEncoder` drops these by default."""

    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.astimezone(UTC_0).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        return super().default(obj)


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
    serialize(
        "json",
        yield_objects(),
        indent=indent,
        stream=dest,
        use_natural_foreign_keys=True,
        cls=DatetimeSafeDjangoJSONEncoder,
    )
