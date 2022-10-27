import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import override_settings
from django_zero_downtime_migrations.backends.postgres.schema import UnsafeOperationException

from sentry.testutils import TestCase


class BaseSafeMigrationTest(TestCase):
    BASE_PATH = "fixtures.safe_migrations_apps"
    app = None
    migrate_from = None
    migrate_to = None

    def run_migration(self):
        with override_settings(INSTALLED_APPS=(f"{self.BASE_PATH}.{self.app}",)):
            migrate_from = [(self.app, self.migrate_from)]
            migrate_to = [(self.app, self.migrate_to)]
            executor = MigrationExecutor(connection)
            executor.loader.project_state(migrate_from).apps

            # Reverse to the original migration
            executor.migrate(migrate_from)

            # Run the migration to test
            executor = MigrationExecutor(connection)
            executor.loader.build_graph()  # reload.
            executor.migrate(migrate_to)
            executor.loader.project_state(migrate_to).apps


class AddColWithDefaultTest(BaseSafeMigrationTest):
    app = "bad_flow_add_column_with_default_app"
    migrate_from = "0001_initial"
    migrate_to = "0002_add_field_default"

    def test(self):
        with pytest.raises(
            UnsafeOperationException,
            match="Adding TestTable.field as column with a default is safe, but you need to take additional steps.",
        ):
            self.run_migration()


class AddColWithNotNullDefaultTest(BaseSafeMigrationTest):
    app = "bad_flow_add_column_with_notnull_default_app"
    migrate_from = "0001_initial"
    migrate_to = "0002_add_field_notnull_default"

    def test(self):
        with pytest.raises(
            UnsafeOperationException,
            match="Adding TestTable.field as column with a default is safe, but you need to take additional steps.",
        ):
            self.run_migration()


class AddColWithNotNullTest(BaseSafeMigrationTest):
    app = "bad_flow_add_column_with_notnull_app"
    migrate_from = "0001_initial"
    migrate_to = "0002_add_field_notnull"

    def test(self):
        with pytest.raises(
            UnsafeOperationException, match="Adding TestTable.field as a not null column is unsafe."
        ):
            self.run_migration()


class ChangeCharTypeUnsafeTest(BaseSafeMigrationTest):
    app = "bad_flow_change_char_type_that_unsafe_app"
    migrate_from = "0001_initial"
    migrate_to = "0002_change_type_from_char120_to_char100"

    def test(self):
        with pytest.raises(
            UnsafeOperationException,
            match="Altering the type of column TestTable.field in this way is unsafe",
        ):
            self.run_migration()


class ChangeDecimalToFloatTest(BaseSafeMigrationTest):
    app = "decimal_to_float_app"
    migrate_from = "0001_initial"
    migrate_to = "0002_type_conversion"

    def test(self):
        with pytest.raises(
            UnsafeOperationException,
            match="Altering the type of column Value.amount in this way is unsafe",
        ):
            self.run_migration()


class RenameTableTest(BaseSafeMigrationTest):
    app = "bad_flow_rename_table_app"
    migrate_from = "0001_initial"
    migrate_to = "0002_rename_table"

    def test(self):
        with pytest.raises(
            UnsafeOperationException,
            match="Renaming table for model NewTable from bad_flow_rename_table_app_testtable to bad_flow_rename_table_app_newtable is unsafe",
        ):
            self.run_migration()


class RenameFieldTest(BaseSafeMigrationTest):
    app = "bad_flow_rename_field_app"
    migrate_from = "0001_initial"
    migrate_to = "0002_rename_field"

    def test(self):
        with pytest.raises(
            UnsafeOperationException, match="Renaming column TestTable.field to new_field is unsafe"
        ):
            self.run_migration()


class DeleteModelTest(BaseSafeMigrationTest):
    app = "bad_flow_delete_model_app"
    migrate_from = "0001_initial"
    migrate_to = "0002_delete_model"

    def test(self):
        with pytest.raises(
            UnsafeOperationException,
            match="Deleting the TestTable model is unsafe.",
        ):
            self.run_migration()


class RemoveFieldTest(BaseSafeMigrationTest):
    app = "bad_flow_remove_field_app"
    migrate_from = "0001_initial"
    migrate_to = "0002_remove_field"

    def test(self):
        with pytest.raises(
            UnsafeOperationException,
            match="Removing the TestTable.field field is unsafe",
        ):
            self.run_migration()


class DeleteModelCorrectTest(BaseSafeMigrationTest):
    app = "good_flow_delete_model_state_app"
    migrate_from = "0001_initial"
    migrate_to = "0003_delete_table"

    def test(self):
        self.run_migration()
