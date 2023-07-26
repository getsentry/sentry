from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Type

from click.testing import CliRunner
from django.core.management import call_command
from django.db import models, router

from sentry.models.organization import Organization
from sentry.runner.commands.backup import (
    ComparatorFindings,
    DatetimeSafeDjangoJSONEncoder,
    export,
    import_,
    validate,
)
from sentry.silo import unguarded_write
from sentry.utils import json
from sentry.utils.json import JSONData


class ValidationError(Exception):
    def __init__(self, info: ComparatorFindings):
        super().__init__(info.pretty())
        self.info = info


def get_final_derivations_of(model: Type):
    """A "final" derivation of the given `model` base class is any non-abstract class for the
    "sentry" app with `BaseModel` as an ancestor. Top-level calls to this class should pass in `BaseModel` as the argument."""
    out = set()
    for sub in model.__subclasses__():
        subs = sub.__subclasses__()
        if subs:
            out.update(get_final_derivations_of(sub))
        if not sub._meta.abstract and sub._meta.db_table and sub._meta.app_label == "sentry":
            out.add(sub)
    return out


def get_exportable_final_derivations_of(model: Type):
    """Like `get_final_derivations_of`, except that it further filters the results to include only `__include_in_export__ = True`."""
    return set(
        filter(
            lambda c: getattr(c, "__include_in_export__") is True,
            get_final_derivations_of(model),
        )
    )


def targets(expected_models: list[Type]):
    """A helper decorator that checks that every model that a test "targeted" was actually seen in
    the output, ensuring that we're actually testing the thing we think we are. Additionally, this
    decorator is easily legible to static analysis, which allows for static checks to ensure that
    all `__include_in_export__ = True` models are being tested.

    To be considered a proper "testing" of a given target type, the resulting output must contain at
    least one instance of that type with all of its fields present and set to non-default values."""

    def decorator(func):
        def wrapped(*args, **kwargs):
            actual = func(*args, **kwargs)
            if actual is None:
                raise AssertionError(f"The test {func.__name__} did not return its actual JSON")

            # Do a quick scan to ensure that at least one instance of each expected model is
            # present.
            actual_model_names = {entry["model"] for entry in actual}
            expected_model_types = {
                "sentry." + type.__name__.lower(): type for type in expected_models
            }
            expected_model_names = set(expected_model_types.keys())
            notfound = sorted(expected_model_names - actual_model_names)
            if len(notfound) > 0:
                raise AssertionError(f"Some `@targets_models` entries were not found: {notfound}")

            # Now do a more thorough check: for every `expected_models` entry, make sure that we
            # have at least one instance of that model that sets all of its fields to some
            # non-default value.
            mistakes_by_model: dict[str, list[str]] = {}
            encoder = DatetimeSafeDjangoJSONEncoder()
            for model in actual:
                name = model["model"]
                if name not in expected_model_names:
                    continue

                data = model["fields"]
                type = expected_model_types[name]
                fields = type._meta.get_fields()
                mistakes = []
                for f in fields:
                    field_name = f.name

                    # IDs are synonymous with primary keys, and should not be included in JSON field
                    # output.
                    if field_name == "id":
                        continue

                    # The model gets a `ManyToOneRel` or `ManyToManyRel` from all other models where
                    # it is referenced by foreign key. Those do not explicitly need to be set - we
                    # don't care that models that reference this model exist, just that this model
                    # exists in its most filled-out form.
                    if isinstance(f, models.ManyToOneRel) or isinstance(f, models.ManyToManyRel):
                        continue

                    # TODO(getsentry/team-ospo#156): For some reason we currently don't always
                    # serialize some `ManyToManyField`s with the `through` property set. I'll
                    # investigate, but will skip over these for now.
                    if isinstance(f, models.ManyToManyField):
                        continue

                    # TODO(getsentry/team-ospo#156): Maybe make these checks recursive for models
                    # that have POPOs for some of their field values?
                    if field_name not in data:
                        mistakes.append(f"Must include field: `{field_name}`")
                        continue
                    if f.has_default():
                        default_value = f.get_default()
                        serialized = encoder.encode(default_value)
                        if serialized == data:
                            mistakes.append(f"Must use non-default data: `{field_name}`")
                            return

                # If one model instance has N mistakes, and another has N - 1 mistakes, we want to
                # keep the shortest list, to give the user the smallest number of fixes to make when
                # reporting the mistake.
                if name not in mistakes_by_model or (len(mistakes) < len(mistakes_by_model[name])):
                    mistakes_by_model[name] = mistakes
            for name, mistakes in mistakes_by_model.items():
                num = len(mistakes)
                if num > 0:
                    raise AssertionError(f"Model {name} has {num} mistakes: {mistakes}")

            return actual

        return wrapped

    return decorator


def export_to_file(path: Path) -> json.JSONData:
    """Helper function that exports the current state of the database to the specified file."""

    json_file_path = str(path)
    rv = CliRunner().invoke(
        export, [json_file_path], obj={"silent": True, "indent": 2, "exclude": None}
    )
    assert rv.exit_code == 0, rv.output

    with open(json_file_path) as tmp_file:
        output = json.load(tmp_file)
    return output


def import_export_then_validate(method_name: str) -> JSONData:
    """Test helper that validates that data imported from a temporary `.json` file correctly
    matches the actual outputted export data.

    Return the actual JSON, so that we may use the `@targets` decorator to ensure that we have
    at least one instance of all the "tested for" models in the actual output."""

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_expect = Path(tmpdir).joinpath(f"{method_name}.expect.json")
        tmp_actual = Path(tmpdir).joinpath(f"{method_name}.actual.json")

        # Export the current state of the database into the "expected" temporary file, then
        # parse it into a JSON object for comparison.
        expect = export_to_file(tmp_expect)

        # Write the contents of the "expected" JSON file into the now clean database.
        # TODO(Hybrid-Cloud): Review whether this is the correct route to apply in this case.
        with unguarded_write(using=router.db_for_write(Organization)):
            # Reset the Django database.
            call_command("flush", verbosity=0, interactive=False)

            rv = CliRunner().invoke(import_, [str(tmp_expect)])
            assert rv.exit_code == 0, rv.output

        # Validate that the "expected" and "actual" JSON matches.
        actual = export_to_file(tmp_actual)
        res = validate(expect, actual)
        if res.findings:
            raise ValidationError(res)

    return actual
