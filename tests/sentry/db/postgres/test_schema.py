import pytest
from django.db import connection

from sentry.db.postgres.schema import (
    DatabaseSchemaEditorProxy,
    MakeBtreeGistSchemaEditor,
    SafePostgresDatabaseSchemaEditor,
    SafeReversePostgresDatabaseSchemaEditor,
)


def _proxy() -> DatabaseSchemaEditorProxy:
    return DatabaseSchemaEditorProxy(connection, collect_sql=True, atomic=False)


class TestDatabaseSchemaEditorProxy:
    @pytest.mark.parametrize(
        ("safe", "reverse", "expected_cls"),
        (
            (False, False, MakeBtreeGistSchemaEditor),
            (False, True, MakeBtreeGistSchemaEditor),
            (True, False, SafePostgresDatabaseSchemaEditor),
            (True, True, SafeReversePostgresDatabaseSchemaEditor),
        ),
    )
    def test_selects_schema_editor_class(
        self, safe: bool, reverse: bool, expected_cls: type
    ) -> None:
        with _proxy() as proxy:
            proxy.safe = safe
            proxy.reverse = reverse
            assert type(proxy.schema_editor) is expected_cls

    def test_set_safe_after_use_raises(self) -> None:
        with _proxy() as proxy:
            proxy.schema_editor
            with pytest.raises(DatabaseSchemaEditorProxy.AlreadyInUse):
                proxy.safe = True

    def test_set_reverse_after_use_raises(self) -> None:
        with _proxy() as proxy:
            proxy.schema_editor
            with pytest.raises(DatabaseSchemaEditorProxy.AlreadyInUse):
                proxy.reverse = True
