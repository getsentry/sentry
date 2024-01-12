from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Type

from django.db.models import Model

from sentry.backup.dependencies import NormalizedModelName
from sentry.backup.imports import (
    import_in_config_scope,
    import_in_global_scope,
    import_in_organization_scope,
)
from sentry.backup.scopes import ExportScope
from sentry.testutils.helpers.backups import (
    NOOP_PRINTER,
    BackupTestCase,
    clear_database,
    export_to_file,
)
from sentry.testutils.silo import region_silo_test
from tests.sentry.backup import expect_models, verify_models_in_output

EXHAUSTIVELY_TESTED: set[NormalizedModelName] = set()
UNIQUENESS_TESTED: set[NormalizedModelName] = set()


@region_silo_test
class ExhaustiveTests(BackupTestCase):
    """
    Ensure that a database with all exportable models filled out still works.
    """

    def export_to_tmp_file_and_clear_database(self, tmp_dir, reset_pks) -> Path:
        tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.expect.json")
        export_to_file(tmp_path, ExportScope.Global)
        clear_database(reset_pks=reset_pks)
        return tmp_path

    @expect_models(EXHAUSTIVELY_TESTED, "__all__")
    def test_exhaustive_clean_pks(self, expected_models: list[Type[Model]]):
        self.create_exhaustive_instance(is_superadmin=True)
        actual = self.import_export_then_validate(self._testMethodName, reset_pks=True)
        verify_models_in_output(expected_models, actual)

    @expect_models(EXHAUSTIVELY_TESTED, "__all__")
    def test_exhaustive_dirty_pks(self, expected_models: list[Type[Model]]):
        self.create_exhaustive_instance(is_superadmin=True)
        actual = self.import_export_then_validate(self._testMethodName, reset_pks=False)
        verify_models_in_output(expected_models, actual)

    @expect_models(UNIQUENESS_TESTED, "__all__")
    def test_uniqueness(self, expected_models: list[Type[Model]]):
        self.create_exhaustive_instance(is_superadmin=True)
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Export the data once.
            tmp_expect = Path(tmp_dir).joinpath(f"{self._testMethodName}.expect.json")
            export_to_file(tmp_expect, ExportScope.Global)
            clear_database(reset_pks=False)

            # Now import twice, so that all random values in the export (UUIDs etc) are identical,
            # to test that these are properly replaced and handled.
            with open(tmp_expect, "rb") as tmp_file:
                import_in_global_scope(tmp_file, printer=NOOP_PRINTER)
            with open(tmp_expect, "rb") as tmp_file:
                # Back-to-back global scope imports are disallowed (global scope assume a clean
                # database), so use organization and config scope instead.
                import_in_organization_scope(tmp_file, printer=NOOP_PRINTER)
                tmp_file.seek(0)
                import_in_config_scope(tmp_file, printer=NOOP_PRINTER)

            tmp_actual = Path(tmp_dir).joinpath(f"{self._testMethodName}.actual.json")
            actual = export_to_file(tmp_actual, ExportScope.Global)
            verify_models_in_output(expected_models, actual)
