from django.db.backends.postgresql.schema import (
    DatabaseSchemaEditor as PostgresDatabaseSchemaEditor,
)
from django_zero_downtime_migrations.backends.postgres.schema import (
    DatabaseSchemaEditorMixin,
    Unsafe,
    UnsafeOperationException,
)

unsafe_mapping = {
    Unsafe.ADD_COLUMN_NOT_NULL: (
        "Adding {model}.{field} as a not null column is unsafe.\n"
        "More info: https://develop.sentry.dev/database-migrations/#adding-not-null-to-columns"
    ),
    Unsafe.ADD_COLUMN_DEFAULT: (
        "Adding {model}.{field} as column with a default is unsafe.\n"
        "More info: https://develop.sentry.dev/database-migrations/#adding-columns-with-a-default"
    ),
    # TODO: Add info about which model/column/type
    Unsafe.ALTER_COLUMN_TYPE: (
        "ALTER COLUMN TYPE is unsafe operation\n"
        "See details for safe alternative "
        "https://develop.sentry.dev/database-migrations/#altering-column-types"
    ),
    Unsafe.ADD_CONSTRAINT_EXCLUDE: (
        "Adding an exclusion constraint is unsafe\n"
        "We don't use these at Sentry currently, bring this up in #discuss-backend"
    ),
    # TODO: Add info about which model is being renamed
    Unsafe.ALTER_TABLE_RENAME: (
        "Renaming a table is unsafe.\n"
        "More info here: https://develop.sentry.dev/database-migrations/#renaming-tables"
    ),
    Unsafe.ALTER_TABLE_SET_TABLESPACE: (
        "Changing the tablespace for a table is unsafe\n"
        "There's probably no reason to do this via a migration. Bring this up in #discuss-backend"
    ),
    # TODO: Add info about which column is being renamed
    Unsafe.ALTER_TABLE_RENAME_COLUMN: (
        "Renaming a column is unsafe.\n"
        "More info here: https://develop.sentry.dev/database-migrations/#renaming-columns"
    ),
    # TODO: Add DROP_COLUMN warnings
}


class SafePostgresDatabaseSchemaEditor(DatabaseSchemaEditorMixin, PostgresDatabaseSchemaEditor):
    def add_field(self, model, field):
        """
        Just exists to translate error messages from zero-downtime-migrations to our
        custom error messages.
        """
        try:
            super().add_field(model, field)
        except UnsafeOperationException as e:
            raise UnsafeOperationException(
                unsafe_mapping[str(e)].format(model=model.__name__, field=field.name)
            )


class DatabaseSchemaEditorProxy:
    """
    Wrapper that allows us to use either the `SafePostgresDatabaseSchemaEditor` or
    `PostgresDatabaseSchemaEditor`. Can be configured by setting the `safe` property
    before using to edit the schema. If already in use, attempts to modify `safe` will
    fail.
    """

    class AlreadyInUse(Exception):
        pass

    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs
        self._safe = False
        self._schema_editor = None

    @property
    def safe(self):
        return self._safe

    @safe.setter
    def safe(self, safe):
        if self._schema_editor is not None:
            raise self.AlreadyInUse("Schema editor already in use, can't set `safe`")

        self._safe = safe

    @property
    def schema_editor(self):
        if self._schema_editor is None:
            schema_editor_cls = (
                SafePostgresDatabaseSchemaEditor if self.safe else PostgresDatabaseSchemaEditor
            )
            schema_editor = schema_editor_cls(*self.args, **self.kwargs)
            schema_editor.__enter__()
            self._schema_editor = schema_editor
        return self._schema_editor

    def __getattr__(self, name):
        return getattr(self.schema_editor, name)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.schema_editor.__exit__(exc_type, exc_val, exc_tb)
