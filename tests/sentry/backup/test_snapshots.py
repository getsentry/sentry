from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from sentry.backup.comparators import get_default_comparators
from sentry.backup.findings import ComparatorFindingKind, InstanceID
from sentry.backup.imports import import_in_global_scope
from sentry.backup.scopes import ExportScope
from sentry.backup.validate import validate
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import (
    NOOP_PRINTER,
    BackupTestCase,
    ValidationError,
    clear_database,
    export_to_file,
)
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


@region_silo_test
class SnapshotTests(BackupTestCase):
    """
    Tests against specific JSON snapshots.
    """

    def setUp(self):
        super().setUp()
        clear_database(reset_pks=True)

    def import_export_fixture_then_validate(
        self, *, tmp_out_path: Path, fixture_file_name: str
    ) -> json.JSONData:
        """
        Test helper that validates that data imported from a fixture `.json` file correctly matches
        the actual outputted export data.
        """

        fixture_file_path = get_fixture_path("backup", fixture_file_name)
        with open(fixture_file_path) as backup_file:
            expect = json.load(backup_file)
        with open(fixture_file_path, "rb") as fixture_file:
            import_in_global_scope(fixture_file, printer=NOOP_PRINTER)

        actual = export_to_file(tmp_out_path, ExportScope.Global)
        res = validate(expect, actual, get_default_comparators())
        if res.findings:
            raise ValidationError(res)

        return actual

    def test_date_with_and_without_zeroed_millis(self):
        with TemporaryDirectory() as tmp_dir, pytest.raises(ValidationError) as execinfo:
            tmp_out_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            self.import_export_fixture_then_validate(
                tmp_out_path=tmp_out_path, fixture_file_name="datetime-millis.json"
            )

        findings = execinfo.value.info.findings
        assert len(findings) == 1
        assert findings[0].kind == ComparatorFindingKind.UnequalJSON
        assert findings[0].on == InstanceID("sentry.option", 2)
        assert findings[0].left_pk == 2
        assert findings[0].right_pk == 2
        assert """-  "last_updated": "2023-06-22T00:00:00Z",""" in findings[0].reason
        assert """+  "last_updated": "2023-06-22T00:00:00.000Z",""" in findings[0].reason

    def test_app_user_with_empty_email(self):
        with TemporaryDirectory() as tmp_dir:
            tmp_out_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            self.import_export_fixture_then_validate(
                tmp_out_path=tmp_out_path, fixture_file_name="app-user-with-empty-email.json"
            )
