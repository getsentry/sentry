from __future__ import annotations

import tempfile
from pathlib import Path

from django.apps import apps
from django.core.management import call_command
from django.db import connections, router, transaction

from sentry.backup.comparators import ComparatorMap
from sentry.backup.dependencies import sorted_dependencies
from sentry.backup.exports import OldExportConfig, exports
from sentry.backup.findings import ComparatorFindings
from sentry.backup.imports import OldImportConfig, imports
from sentry.backup.validate import validate
from sentry.models.integrations.sentry_app import SentryApp
from sentry.silo import unguarded_write
from sentry.testutils.factories import get_fixture_path
from sentry.utils import json
from sentry.utils.json import JSONData

__all__ = [
    "export_to_file",
    "import_export_then_validate",
    "import_export_from_fixture_then_validate",
    "ValidationError",
]

NOOP_PRINTER = lambda *args, **kwargs: None


class ValidationError(Exception):
    def __init__(self, info: ComparatorFindings):
        super().__init__(info.pretty())
        self.info = info


def export_to_file(path: Path) -> JSONData:
    """Helper function that exports the current state of the database to the specified file."""

    json_file_path = str(path)
    with open(json_file_path, "w+") as tmp_file:
        exports(tmp_file, OldExportConfig(), 2, NOOP_PRINTER)

    with open(json_file_path) as tmp_file:
        output = json.load(tmp_file)
    return output


REVERSED_DEPENDENCIES = sorted_dependencies()
REVERSED_DEPENDENCIES.reverse()


def clear_database_but_keep_sequences():
    """Deletes all models we care about from the database, in a sequence that ensures we get no
    foreign key errors."""

    with unguarded_write(using="default"), transaction.atomic(using="default"):
        for model in REVERSED_DEPENDENCIES:
            # For some reason, the tables for `SentryApp*` models don't get deleted properly here
            # when using `model.objects.all().delete()`, so we have to call out to Postgres
            # manually.
            connection = connections[router.db_for_write(SentryApp)]
            with connection.cursor() as cursor:
                table = model._meta.db_table
                cursor.execute(f"DELETE FROM {table:s};")

        # Clear remaining tables that are not explicitly in Sentry's own model dependency graph.
        for model in set(apps.get_models()) - set(REVERSED_DEPENDENCIES):
            model.objects.all().delete()


def import_export_then_validate(method_name: str, *, reset_pks: bool = True) -> JSONData:
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
            if reset_pks:
                call_command("flush", verbosity=0, interactive=False)
            else:
                clear_database_but_keep_sequences()

            with open(tmp_expect) as tmp_file:
                imports(tmp_file, OldImportConfig(), NOOP_PRINTER)

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
    with unguarded_write(using="default"), open(fixture_file_path) as fixture_file:
        imports(fixture_file, OldImportConfig(), NOOP_PRINTER)

    res = validate(expect, export_to_file(tmp_path.joinpath("tmp_test_file.json")), map)
    if res.findings:
        raise ValidationError(res)
