from django.db.backends.postgresql.schema import (
    DatabaseSchemaEditor as PostgresDatabaseSchemaEditor,
)
from django.db.models import Field
from django.db.models.base import ModelBase
from django_zero_downtime_migrations.backends.postgres.schema import (
    DatabaseSchemaEditorMixin,
    Unsafe,
    UnsafeOperationException,
)

unsafe_mapping = {
    Unsafe.ADD_COLUMN_DEFAULT: (
        "Adding {}.{} as column with a default is safe, but you need to take additional steps.\n"
        "Follow this guide: https://develop.sentry.dev/database-migrations/#adding-columns-with-a-default"
    ),
    Unsafe.ADD_COLUMN_NOT_NULL: (
        "Adding {}.{} as a not null column is unsafe.\n"
        "More info: https://develop.sentry.dev/database-migrations/#adding-not-null-to-columns"
    ),
    Unsafe.ALTER_COLUMN_TYPE: (
        "Altering the type of column {}.{} in this way is unsafe\n"
        "More info here: https://develop.sentry.dev/database-migrations/#altering-column-types"
    ),
    # TODO: If we use > 3.0 we can add tests to verify this
    Unsafe.ADD_CONSTRAINT_EXCLUDE: (
        "Adding an exclusion constraint is unsafe\n"
        "We don't use these at Sentry currently, bring this up in #discuss-backend"
    ),
    Unsafe.ALTER_TABLE_SET_TABLESPACE: (
        "Changing the tablespace for a table is unsafe\n"
        "There's probably no reason to do this via a migration. Bring this up in #discuss-backend"
    ),
    Unsafe.ALTER_TABLE_RENAME_COLUMN: (
        "Renaming column {}.{} to {} is unsafe.\n"
        "More info here: https://develop.sentry.dev/database-migrations/#renaming-columns"
    ),
}


def value_translator(value):
    if isinstance(value, Field):
        return value.name
    if isinstance(value, ModelBase):
        return value.__name__
    return value


def translate_unsafeoperation_exception(func):
    def inner(self, *args, **kwargs):
        try:
            func(self, *args, **kwargs)
        except UnsafeOperationException as e:
            exc_str = unsafe_mapping.get(str(e))
            if exc_str is None:
                raise

            formatted_args = [value_translator(arg) for arg in args]

            raise UnsafeOperationException(exc_str.format(*formatted_args))

    return inner


class SafePostgresDatabaseSchemaEditor(DatabaseSchemaEditorMixin, PostgresDatabaseSchemaEditor):
    add_field = translate_unsafeoperation_exception(PostgresDatabaseSchemaEditor.add_field)
    alter_field = translate_unsafeoperation_exception(PostgresDatabaseSchemaEditor.alter_field)
    alter_db_tablespace = translate_unsafeoperation_exception(
        PostgresDatabaseSchemaEditor.alter_db_tablespace
    )

    def alter_db_table(self, model, old_db_table, new_db_table):
        """
        This didn't work correctly in  django_zero_downtime_migrations, so implementing here. This
        method is only used to modify table name, so we just need to raise.
        """
        raise UnsafeOperationException(
            f"Renaming table for model {model.__name__} from {old_db_table} to {new_db_table} is unsafe.\n"
            "More info here: https://develop.sentry.dev/database-migrations/#renaming-tables"
        )

    def delete_model(self, model):
        """
        It's never safe to delete a model using the standard migration process
        """
        raise UnsafeOperationException(
            f"Deleting the {model.__name__} model is unsafe.\n"
            "More info here: https://develop.sentry.dev/database-migrations/#tables"
        )

    def remove_field(self, model, field):
        """
        It's never safe to remove a field using the standard migration process
        """
        raise UnsafeOperationException(
            f"Removing the {model.__name__}.{field.name} field is unsafe.\n"
            "More info here: https://develop.sentry.dev/database-migrations/#columns"
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
