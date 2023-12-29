from __future__ import annotations

import os
import tempfile
from pathlib import Path

import yaml

from sentry.backup.comparators import get_default_comparators
from sentry.backup.dependencies import NormalizedModelName
from sentry.backup.imports import import_in_global_scope
from sentry.backup.scopes import ExportScope
from sentry.backup.validate import validate
from sentry.testutils.helpers.backups import (
    NOOP_PRINTER,
    BackupTestCase,
    clear_database,
    export_to_file,
)
from sentry.testutils.pytest.fixtures import read_snapshot_file
from sentry.testutils.silo import region_silo_test, strip_silo_mode_test_suffix
from sentry.utils import json
from tests.sentry.backup import mark, targets

RELEASE_TESTED: set[NormalizedModelName] = set()


@region_silo_test
class ReleaseTests(BackupTestCase):
    """
    Ensure that exports from the last two released versions of self-hosted are still able to be
    imported.
    """

    def setUp(self):
        clear_database(reset_pks=True)

    @classmethod
    def get_snapshot_path(cls, release: str) -> str:
        root_dir = os.path.dirname(os.path.realpath(__file__))

        # Use the same data for monolith and region mode.
        class_name = strip_silo_mode_test_suffix(cls.__name__)
        return f"{root_dir}/snapshots/{class_name}/test_at_{release.replace('.', '_')}.pysnap"

    # Note: because we are using the 'insta_snapshot` feature of pysnap, the files will be
    # saved as annotated YAML files, not JSON. While this is not strictly a supported format
    # for relocation (it's JSON-only), since YAML is a superset of JSON, this should be
    # okay, and we can think of these files as valid JSON exports saved using a slightly
    # different presentation for ease of testing.
    @staticmethod
    def snapshot_inequality_comparator(refval: str, output: str) -> str | bool:
        refval_json = yaml.safe_load(refval) or dict()
        output_json = yaml.safe_load(output)
        result = validate(refval_json, output_json, get_default_comparators())
        if not result.empty():
            # Instead of returning a simple diff, which will differ in ways that are not
            # necessarily relevant to the comparison (newly minted tokens, etc), we just
            # return the validation comparison findings in pretty-printed form.
            return "The following inconsistences were found:\n\n" + result.pretty()

        return False

    @targets(mark(RELEASE_TESTED, "__all__"))
    def test_at_head(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Convert the existing snapshot from YAML to an equivalent temporary JSON file.
            snapshot_path = self.get_snapshot_path("head")
            _, snapshot_refval = read_snapshot_file(snapshot_path)
            snapshot_data = yaml.safe_load(snapshot_refval) or dict()
            tmp_refval_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.refval.json")
            with open(tmp_refval_path, "w") as f:
                json.dump(snapshot_data, f)

            # Take that temporary JSON file and import it. If `SENTRY_SNAPSHOTS_WRITEBACK` is set to
            # true, ignore the data in the existing snapshot file and generate a new exhaustive
            # instance instead.
            if os.environ.get("SENTRY_SNAPSHOTS_WRITEBACK", "0") != "0":
                self.create_exhaustive_instance(is_superadmin=True)
            else:
                with open(tmp_refval_path, "rb") as f:
                    import_in_global_scope(f, printer=NOOP_PRINTER)

            # Export the database state for use in snapshot comparisons/generation.
            tmp_export_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.export.json")
            exported = export_to_file(tmp_export_path, ExportScope.Global)

            # Ensure that the exported data matches the original snapshot (that is, that importing
            # and then exporting produces a validation with no findings).
            self.insta_snapshot(
                exported,
                inequality_comparator=self.snapshot_inequality_comparator,
                reference_file=snapshot_path,
            )

            # Return the export so that we can ensure that all models were seen.
            return exported

    def test_at_23_12_1(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            _, snapshot_refval = read_snapshot_file(self.get_snapshot_path("23.12.1"))
            snapshot_data = yaml.safe_load(snapshot_refval)
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w") as f:
                json.dump(snapshot_data, f)

            with open(tmp_path, "rb") as f:
                import_in_global_scope(f, printer=NOOP_PRINTER)

    def test_at_23_12_0(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            _, snapshot_refval = read_snapshot_file(self.get_snapshot_path("23.12.0"))
            snapshot_data = yaml.safe_load(snapshot_refval)
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w") as f:
                json.dump(snapshot_data, f)

            with open(tmp_path, "rb") as f:
                import_in_global_scope(f, printer=NOOP_PRINTER)

    def test_at_23_11_2(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            _, snapshot_refval = read_snapshot_file(self.get_snapshot_path("23.11.2"))
            snapshot_data = yaml.safe_load(snapshot_refval)
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w") as f:
                json.dump(snapshot_data, f)

            with open(tmp_path, "rb") as f:
                import_in_global_scope(f, printer=NOOP_PRINTER)

    def test_at_23_11_1(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            _, snapshot_refval = read_snapshot_file(self.get_snapshot_path("23.11.1"))
            snapshot_data = yaml.safe_load(snapshot_refval)
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w") as f:
                json.dump(snapshot_data, f)

            with open(tmp_path, "rb") as f:
                import_in_global_scope(f, printer=NOOP_PRINTER)

    def test_at_23_11_0(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            _, snapshot_refval = read_snapshot_file(self.get_snapshot_path("23.11.0"))
            snapshot_data = yaml.safe_load(snapshot_refval)
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            with open(tmp_path, "w") as f:
                json.dump(snapshot_data, f)

            with open(tmp_path, "rb") as f:
                import_in_global_scope(f, printer=NOOP_PRINTER)
