import pytest
from django.db import connection, migrations
from django.db.migrations.operations.base import Operation
from django.db.migrations.state import ProjectState
from django_zero_downtime_migrations.backends.postgres.schema import UnsafeOperationException

from sentry.db.postgres.schema import (
    DatabaseSchemaEditorProxy,
    MakeBtreeGistSchemaEditor,
    SafePostgresDatabaseSchemaEditor,
    SafeReversePostgresDatabaseSchemaEditor,
)
from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL


def _migration(operations: list[Operation], checked: bool = True) -> CheckedMigration:
    migration_cls = type(
        "Migration", (CheckedMigration,), {"operations": operations, "checked": checked}
    )
    return migration_cls("0001_test", "sentry")


def _schema_editor() -> DatabaseSchemaEditorProxy:
    return DatabaseSchemaEditorProxy(connection, collect_sql=True, atomic=False)


class TestCheckedMigrationApply:
    def test_selects_safe_schema_editor(self) -> None:
        with _schema_editor() as editor:
            _migration([]).apply(ProjectState(), editor, collect_sql=True)
            assert type(editor.schema_editor) is SafePostgresDatabaseSchemaEditor

    def test_unchecked_selects_unsafe_schema_editor(self) -> None:
        with _schema_editor() as editor:
            _migration([], checked=False).apply(ProjectState(), editor, collect_sql=True)
            assert type(editor.schema_editor) is MakeBtreeGistSchemaEditor


class TestCheckedMigrationUnapply:
    def test_selects_safe_reverse_schema_editor(self) -> None:
        with _schema_editor() as editor:
            _migration([]).unapply(ProjectState(), editor, collect_sql=True)
            assert type(editor.schema_editor) is SafeReversePostgresDatabaseSchemaEditor

    def test_unchecked_selects_unsafe_schema_editor(self) -> None:
        with _schema_editor() as editor:
            _migration([], checked=False).unapply(ProjectState(), editor, collect_sql=True)
            assert type(editor.schema_editor) is MakeBtreeGistSchemaEditor

    def test_validates_operations(self) -> None:
        migration = _migration([migrations.RunSQL("SELECT 1", reverse_sql="SELECT 1")])
        with _schema_editor() as editor:
            with pytest.raises(UnsafeOperationException, match="Using `RunSQL` is unsafe"):
                migration.unapply(ProjectState(), editor, collect_sql=True)

    def test_validates_operations_when_unchecked(self) -> None:
        # `checked = False` skips the safe schema editor but, like `apply`, still
        # forbids raw RunSQL operations.
        migration = _migration(
            [migrations.RunSQL("SELECT 1", reverse_sql="SELECT 1")], checked=False
        )
        with _schema_editor() as editor:
            with pytest.raises(UnsafeOperationException, match="Using `RunSQL` is unsafe"):
                migration.unapply(ProjectState(), editor, collect_sql=True)

    def test_safe_run_sql_runs_reverse_sql(self) -> None:
        migration = _migration(
            [
                SafeRunSQL(
                    "SELECT 'forward'",
                    reverse_sql="SELECT 'backward'",
                    hints={"tables": ["sentry_savedsearch"]},
                )
            ]
        )
        with _schema_editor() as editor:
            migration.unapply(ProjectState(), editor, collect_sql=True)
            assert "SELECT 'backward';" in editor.collected_sql
