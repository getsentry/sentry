from django.contrib.postgres.constraints import ExclusionConstraint
from django.db.backends.postgresql.schema import (
    DatabaseSchemaEditor as PostgresDatabaseSchemaEditor,
)
from django.db.models import Field, Model
from django.db.models.base import ModelBase
from django.db.models.constraints import BaseConstraint
from django_zero_downtime_migrations.backends.postgres.schema import (
    DatabaseSchemaEditorMixin,
    Unsafe,
    UnsafeOperationException,
)

unsafe_mapping = {
    Unsafe.ADD_COLUMN_NOT_NULL: (
        "Adding {}.{} as a not null column with no default is unsafe. Provide a default using db_default. \n"
        "More info: https://develop.sentry.dev/api-server/application-domains/database-migrations/#adding-columns-with-a-default"
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


class MakeBtreeGistSchemaEditor(PostgresDatabaseSchemaEditor):
    """workaround for https://code.djangoproject.com/ticket/36374"""

    def create_model(self, model: type[Model]) -> None:
        if any(isinstance(c, ExclusionConstraint) for c in model._meta.constraints):
            self.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")
        super().create_model(model)

    def add_constraint(self, model: type[Model], constraint: BaseConstraint) -> None:
        if isinstance(constraint, ExclusionConstraint):
            self.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")
        super().add_constraint(model, constraint)


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

    def delete_model(self, model, is_safe=False):
        """
        It's never safe to delete a model using the standard migration process
        """
        if not is_safe:
            raise UnsafeOperationException(
                f"Deleting the {model.__name__} model is unsafe.\n"
                "More info here: https://develop.sentry.dev/database-migrations/#deleting-tables"
            )
        super(DatabaseSchemaEditorMixin, self).delete_model(model)

    def remove_field(self, model, field, is_safe=False):
        """
        It's never safe to remove a field using the standard migration process
        """
        if not is_safe:
            raise UnsafeOperationException(
                f"Removing the {model.__name__}.{field.name} field is unsafe.\n"
                "More info here: https://develop.sentry.dev/database-migrations/#deleting-columns"
            )
        super(DatabaseSchemaEditorMixin, self).remove_field(model, field)


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
                SafePostgresDatabaseSchemaEditor if self.safe else MakeBtreeGistSchemaEditor
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
