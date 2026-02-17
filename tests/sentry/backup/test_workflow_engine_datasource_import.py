from __future__ import annotations

import tempfile
from pathlib import Path

import orjson

from sentry.backup.imports import import_in_organization_scope
from sentry.backup.scopes import ExportScope
from sentry.snuba.models import QuerySubscription
from sentry.testutils.helpers.backups import (
    NOOP_PRINTER,
    BackupTransactionTestCase,
    clear_database,
    export_to_file,
)
from sentry.workflow_engine.models import DataSource, Detector


class DataSourceImportOrderTest(BackupTransactionTestCase):
    """
    Tests that DataSource imports work correctly even when the JSON is ordered
    incorrectly (DataSource before QuerySubscription), which can happen with
    exports created before __relocation_dependencies__ was added to DataSource.
    """

    def test_datasource_import_with_wrong_ordering(self) -> None:
        owner = self.create_exhaustive_user("owner")
        invited = self.create_exhaustive_user("invited")
        self.create_exhaustive_organization("test-org", owner, invited)

        datasource_count_before = DataSource.objects.count()
        querysubscription_count_before = QuerySubscription.objects.count()
        detector_count_before = Detector.objects.count()

        assert datasource_count_before > 0
        assert querysubscription_count_before > 0
        assert detector_count_before > 0

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath("test_export.json")
            export_to_file(tmp_path, ExportScope.Global)

            with open(tmp_path, "rb") as f:
                models = orjson.loads(f.read())

            datasource_models = [m for m in models if m["model"] == "workflow_engine.datasource"]
            other_models = [m for m in models if m["model"] != "workflow_engine.datasource"]

            assert len(datasource_models) > 0

            # Put DataSources at the beginning (wrong order - they depend on QuerySubscriptions)
            incorrectly_ordered = datasource_models + other_models

            with open(tmp_path, "wb") as f:
                f.write(orjson.dumps(incorrectly_ordered))

            clear_database()

            assert DataSource.objects.count() == 0
            assert QuerySubscription.objects.count() == 0
            assert Detector.objects.count() == 0

            with open(tmp_path, "rb") as f:
                import_in_organization_scope(f, printer=NOOP_PRINTER)

        datasources_after = DataSource.objects.count()
        querysubscriptions_after = QuerySubscription.objects.count()

        assert datasources_after == datasource_count_before, (
            f"Expected {datasource_count_before} DataSources after import, "
            f"got {datasources_after}. The automatic reordering should have fixed this."
        )

        assert querysubscriptions_after == querysubscription_count_before, (
            f"Expected {querysubscription_count_before} QuerySubscriptions after import, "
            f"got {querysubscriptions_after}"
        )
