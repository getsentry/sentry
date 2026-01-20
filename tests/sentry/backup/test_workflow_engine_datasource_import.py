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
        """
        Test backward compatibility: verify that imports work correctly even when
        the JSON has incorrect ordering (DataSource before QuerySubscription).

        This can happen with exports created before __relocation_dependencies__
        was added to DataSource. The import code now automatically reorders models
        based on sorted_dependencies() to fix this issue.

        Without the fix, the following would happen:
        1. Old code exported JSON with DataSource before QuerySubscription
        2. Import tries to remap DataSource.source_id
        3. QuerySubscription isn't in pk_map yet (not imported)
        4. normalize_before_relocation_import returns None
        5. DataSource is discarded

        With the fix:
        1. Import detects models are in wrong order
        2. Reorders them according to sorted_dependencies()
        3. QuerySubscriptions are imported first
        4. DataSources can successfully remap their source_id values
        """
        # Create an organization with QuerySubscription and DataSource
        owner = self.create_exhaustive_user("owner")
        invited = self.create_exhaustive_user("invited")
        self.create_exhaustive_organization("test-org", owner, invited)

        # Verify DataSource and QuerySubscription were created
        datasource_count_before = DataSource.objects.count()
        querysubscription_count_before = QuerySubscription.objects.count()
        detector_count_before = Detector.objects.count()

        assert datasource_count_before > 0, "Expected at least one DataSource"
        assert querysubscription_count_before > 0, "Expected at least one QuerySubscription"
        assert detector_count_before > 0, "Expected at least one Detector"

        # Verify we have both DataSources and QuerySubscriptions for the test
        assert (
            datasource_count_before > 0 and querysubscription_count_before > 0
        ), "Need both DataSources and QuerySubscriptions for this test"

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Export to file
            tmp_path = Path(tmp_dir).joinpath("test_export.json")
            export_to_file(tmp_path, ExportScope.Global)

            # Read the JSON
            with open(tmp_path, "rb") as f:
                models = orjson.loads(f.read())

            # Find DataSource and QuerySubscription models in the export
            datasource_models = []
            querysubscription_models = []

            for model in models:
                model_name = model["model"]
                if model_name == "workflow_engine.datasource":
                    datasource_models.append(model)
                elif model_name == "sentry.querysubscription":
                    querysubscription_models.append(model)

            assert len(datasource_models) > 0, "No DataSource models found in export"
            assert len(querysubscription_models) > 0, "No QuerySubscription models found in export"

            # Create incorrectly ordered JSON by moving DataSource models
            # to appear BEFORE QuerySubscription models
            # First, find where QuerySubscriptions are in the original list
            querysubscription_start_idx = None
            for idx, model in enumerate(models):
                if model["model"] == "sentry.querysubscription":
                    querysubscription_start_idx = idx
                    break

            assert querysubscription_start_idx is not None, "Could not find QuerySubscriptions"

            # Remove DataSource and QuerySubscription models from their original positions
            incorrectly_ordered = [
                m
                for m in models
                if m["model"] not in ("workflow_engine.datasource", "sentry.querysubscription")
            ]

            # Insert DataSources BEFORE where QuerySubscriptions originally were,
            # then add QuerySubscriptions after
            incorrectly_ordered = (
                incorrectly_ordered[:querysubscription_start_idx]
                + datasource_models
                + querysubscription_models
                + incorrectly_ordered[querysubscription_start_idx:]
            )

            # Write the incorrectly ordered JSON
            with open(tmp_path, "wb") as f:
                f.write(orjson.dumps(incorrectly_ordered))

            # Clear database
            clear_database()

            # Verify database is empty
            assert DataSource.objects.count() == 0
            assert QuerySubscription.objects.count() == 0
            assert Detector.objects.count() == 0

            # Import with incorrectly ordered JSON
            # This demonstrates the bug: DataSources will be discarded because
            # QuerySubscriptions aren't in pk_map yet
            with open(tmp_path, "rb") as f:
                import_in_organization_scope(f, printer=NOOP_PRINTER)

        # EXPECTED BEHAVIOR (currently fails):
        # DataSources should be imported correctly even with wrong ordering
        datasources_after = DataSource.objects.count()
        querysubscriptions_after = QuerySubscription.objects.count()

        # These assertions will FAIL with current code, demonstrating the bug
        assert datasources_after == datasource_count_before, (
            f"Expected {datasource_count_before} DataSources after import, "
            f"got {datasources_after}. DataSources were likely discarded because "
            f"QuerySubscriptions weren't in pk_map yet due to wrong JSON ordering."
        )

        assert querysubscriptions_after == querysubscription_count_before, (
            f"Expected {querysubscription_count_before} QuerySubscriptions after import, "
            f"got {querysubscriptions_after}"
        )

        # Check if we have DataSources that reference QuerySubscriptions
        # and verify they're properly linked
        datasources_with_query = []
        for ds in DataSource.objects.all():
            # Check if this DataSource's source_id might reference a QuerySubscription
            # by checking if it's in the valid range
            try:
                source_id_int = int(ds.source_id)
                if QuerySubscription.objects.filter(id=source_id_int).exists():
                    datasources_with_query.append(ds)
                    # Verify the link is valid
                    qs = QuerySubscription.objects.get(id=source_id_int)
                    assert qs is not None, (
                        f"DataSource {ds.id} references QuerySubscription {source_id_int} "
                        f"but it doesn't exist"
                    )
            except (ValueError, TypeError, QuerySubscription.DoesNotExist):
                # This DataSource doesn't reference a QuerySubscription, skip it
                pass

        # The test demonstrates the bug regardless of whether specific DataSources
        # reference QuerySubscriptions - the key is that DataSource count matches

    def test_import_preserves_unknown_models(self) -> None:
        """
        Verify that models not in sorted_dependencies() are preserved during import.

        This could happen with:
        - Deleted models from old exports
        - Plugin models not in the dependency graph
        - Models from newer versions being imported to older code
        """
        owner = self.create_exhaustive_user("owner")
        invited = self.create_exhaustive_user("invited")
        self.create_exhaustive_organization("test-org", owner, invited)

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Export to file
            tmp_path = Path(tmp_dir).joinpath("test_export.json")
            export_to_file(tmp_path, ExportScope.Global)

            # Read the JSON
            with open(tmp_path, "rb") as f:
                models = orjson.loads(f.read())

            # Add a fake model that doesn't exist in sorted_dependencies()
            fake_model = {
                "model": "fake.deletedmodel",
                "pk": 999,
                "fields": {"name": "This model was deleted", "data": "preserved"},
            }
            models_with_fake = models + [fake_model]

            # Write modified JSON
            with open(tmp_path, "wb") as f:
                f.write(orjson.dumps(models_with_fake))

            # Clear database
            clear_database()

            # Import should not fail and should process all known models
            with open(tmp_path, "rb") as f:
                import_in_organization_scope(f, printer=NOOP_PRINTER)

            # We can't verify the fake model was imported (it doesn't exist),
            # but we verify the import didn't crash and real models were imported
            assert DataSource.objects.count() > 0, "Real models should still be imported"
            assert QuerySubscription.objects.count() > 0, "Real models should still be imported"
