from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Type

from click.testing import CliRunner
from django.core.management import call_command

from sentry.backup.comparators import ComparatorMap
from sentry.backup.findings import ComparatorFindings
from sentry.backup.validate import validate
from sentry.runner.commands.backup import export, import_
from sentry.silo import unguarded_write
from sentry.testutils.factories import get_fixture_path
from sentry.utils import json
from sentry.utils.json import JSONData

__all__ = [
    "ValidationError",
    "export_to_file",
    "get_final_derivations_of",
    "get_exportable_final_derivations_of",
    "import_export_then_validate",
    "import_export_from_fixture_then_validate",
]


class ValidationError(Exception):
    def __init__(self, info: ComparatorFindings):
        super().__init__(info.pretty())
        self.info = info


def export_to_file(path: Path) -> JSONData:
    """Helper function that exports the current state of the database to the specified file."""

    json_file_path = str(path)
    rv = CliRunner().invoke(
        export, [json_file_path], obj={"silent": True, "indent": 2, "exclude": None}
    )
    assert rv.exit_code == 0, rv.output

    with open(json_file_path) as tmp_file:
        # print("\n\n\nOUT: \n\n\n" + tmp_file.read())
        output = json.load(tmp_file)
    return output


def get_final_derivations_of(model: Type):
    """A "final" derivation of the given `model` base class is any non-abstract class for the
    "sentry" app with `BaseModel` as an ancestor. Top-level calls to this class should pass in
    `BaseModel` as the argument."""

    out = set()
    for sub in model.__subclasses__():
        subs = sub.__subclasses__()
        if subs:
            out.update(get_final_derivations_of(sub))
        if not sub._meta.abstract and sub._meta.db_table and sub._meta.app_label == "sentry":
            out.add(sub)
    return out


def get_exportable_final_derivations_of(model: Type):
    """Like `get_final_derivations_of`, except that it further filters the results to include only
    `__include_in_export__ = True`."""

    return set(
        filter(
            lambda c: getattr(c, "__include_in_export__") is True,
            get_final_derivations_of(model),
        )
    )


def import_export_then_validate(method_name: str) -> JSONData:
    """Test helper that validates that dat imported from an export of the current state of the test
    database correctly matches the actual outputted export data."""

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_expect = Path(tmpdir).joinpath(f"{method_name}.expect.json")
        tmp_actual = Path(tmpdir).joinpath(f"{method_name}.actual.json")

        # Export the current state of the database into the "expected" temporary file, then
        # parse it into a JSON object for comparison.
        expect = export_to_file(tmp_expect)

        # Write the contents of the "expected" JSON file into the now clean database.
        # TODO(Hybrid-Cloud): Review whether this is the correct route to apply in this case.
        with unguarded_write(using="default"):
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


EMPTY_COMPARATORS_FOR_TESTING: ComparatorMap = {}


def import_export_from_fixture_then_validate(
    tmp_path: Path,
    fixture_file_name: str,
    map: ComparatorMap = EMPTY_COMPARATORS_FOR_TESTING,
) -> None:
    """Test helper that validates that data imported from a fixture `.json` file correctly matches
    the actual outputted export data."""

    fixture_file_path = get_fixture_path("backup", fixture_file_name)
    with open(fixture_file_path) as backup_file:
        expect = json.load(backup_file)

    # TODO(Hybrid-Cloud): Review whether this is the correct route to apply in this case.
    with unguarded_write(using="default"):
        rv = CliRunner().invoke(import_, [str(fixture_file_path)])
        assert rv.exit_code == 0, rv.output

    res = validate(expect, export_to_file(tmp_path.joinpath("tmp_test_file.json")), map)
    if res.findings:
        raise ValidationError(res)
