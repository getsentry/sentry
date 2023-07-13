from __future__ import annotations

import tempfile
from pathlib import Path

from click.testing import CliRunner
from django.core.management import call_command

from sentry.runner.commands.backup import import_, validate
from sentry.testutils import TransactionTestCase
from sentry.testutils.silo import unguarded_write
from tests.sentry.backup import ValidationError, tmp_export_to_file


class ModelBackupTests(TransactionTestCase):
    """Test the JSON-ification of models marked `__include_in_export__ = True`. Each test here
    creates a fresh database, performs some writes to it, then exports that data into a temporary
    file (called the "expected" JSON). It then imports the "expected" JSON and re-exports it into
    the "actual" JSON file, and diffs the two to ensure that they match per the specified
    comparators."""

    def setUp(self):
        with unguarded_write():
            # Reset the Django database.
            call_command("flush", verbosity=0, interactive=False)

    def import_export_then_validate(self):
        """Test helper that validates that data imported from a temporary `.json` file correctly
        matches the actual outputted export data."""

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_expect = Path(tmpdir).joinpath(f"{self._testMethodName}.expect.json")
            tmp_actual = Path(tmpdir).joinpath(f"{self._testMethodName}.actual.json")

            # Export the current state of the database into the "expected" temporary file, then parse it
            # into a JSON object for comparison.
            expect = tmp_export_to_file(tmp_expect)

            # Write the contents of the "expected" JSON file into the now clean database.
            with unguarded_write():
                # Reset the Django database.
                call_command("flush", verbosity=0, interactive=False)

                rv = CliRunner().invoke(import_, [str(tmp_expect)])
                assert rv.exit_code == 0, rv.output

            # Validate that the "expected" and "actual" JSON matches.
            actual = tmp_export_to_file(tmp_actual)
            res = validate(expect, actual)
            if res.findings:
                raise ValidationError(res)

    def test_organization(self):
        user = self.create_user()
        self.create_organization(owner=user)
        self.import_export_then_validate()
