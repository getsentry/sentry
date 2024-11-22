from contextlib import contextmanager

from django.conf import settings
from django.db.backends.ddl_references import Statement
from django.db.backends.postgresql.schema import (
    DatabaseSchemaEditor as PostgresDatabaseSchemaEditor,
)
from django.db.models import Field
from django.db.models.base import ModelBase
from django_zero_downtime_migrations.backends.postgres.schema import (
    DUMMY_SQL,
    DatabaseSchemaEditorMixin,
    MultiStatementSQL,
    PGLock,
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


class SafePostgresDatabaseSchemaEditor(DatabaseSchemaEditorMixin, PostgresDatabaseSchemaEditor):
    add_field = translate_unsafeoperation_exception(PostgresDatabaseSchemaEditor.add_field)
    alter_field = translate_unsafeoperation_exception(PostgresDatabaseSchemaEditor.alter_field)
    alter_db_tablespace = translate_unsafeoperation_exception(
        PostgresDatabaseSchemaEditor.alter_db_tablespace
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.LOCK_TIMEOUT_FORCE = getattr(
            settings, "ZERO_DOWNTIME_MIGRATIONS_LOCK_TIMEOUT_FORCE", False
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

    def remove_field(self, model, field):
        """
        It's never safe to remove a field using the standard migration process
        """
        raise UnsafeOperationException(
            f"Removing the {model.__name__}.{field.name} field is unsafe.\n"
            "More info here: https://develop.sentry.dev/database-migrations/#deleting-columns"
        )

    def execute(self, sql, params=()):
        if sql is DUMMY_SQL:
            return
        statements = []
        if isinstance(sql, MultiStatementSQL):
            statements.extend(sql)
        elif isinstance(sql, Statement) and isinstance(sql.template, MultiStatementSQL):
            statements.extend(Statement(s, **sql.parts) for s in sql.template)
        else:
            statements.append(sql)
        for statement in statements:
            idempotent_condition = None
            if isinstance(statement, PGLock):
                use_timeouts = statement.use_timeouts
                disable_statement_timeout = statement.disable_statement_timeout
                idempotent_condition = statement.idempotent_condition
                statement = statement.sql
            elif isinstance(statement, Statement) and isinstance(statement.template, PGLock):
                use_timeouts = statement.template.use_timeouts
                disable_statement_timeout = statement.template.disable_statement_timeout
                if statement.template.idempotent_condition is not None:
                    idempotent_condition = statement.template.idempotent_condition % statement.parts
                statement = Statement(statement.template.sql, **statement.parts)
            else:
                use_timeouts = False
                disable_statement_timeout = False

            if not self._skip_applied(idempotent_condition):
                if use_timeouts:
                    with self._set_operation_timeout(self.STATEMENT_TIMEOUT, self.LOCK_TIMEOUT):
                        PostgresDatabaseSchemaEditor.execute(self, statement, params)
                elif self.LOCK_TIMEOUT_FORCE:
                    with self._set_operation_timeout(lock_timeout=self.LOCK_TIMEOUT):
                        PostgresDatabaseSchemaEditor.execute(self, statement, params)
                elif disable_statement_timeout and self.FLEXIBLE_STATEMENT_TIMEOUT:
                    with self._set_operation_timeout(self.ZERO_TIMEOUT):
                        PostgresDatabaseSchemaEditor.execute(self, statement, params)
                else:
                    PostgresDatabaseSchemaEditor.execute(self, statement, params)

    @contextmanager
    def _set_operation_timeout(self, statement_timeout=None, lock_timeout=None):
        if self.collect_sql:
            previous_statement_timeout = self.ZERO_TIMEOUT
            previous_lock_timeout = self.ZERO_TIMEOUT
        else:
            with self.connection.cursor() as cursor:
                cursor.execute(self._sql_get_statement_timeout)
                (previous_statement_timeout,) = cursor.fetchone()
                cursor.execute(self._sql_get_lock_timeout)
                (previous_lock_timeout,) = cursor.fetchone()
        if statement_timeout is not None:
            PostgresDatabaseSchemaEditor.execute(
                self, self._sql_set_statement_timeout % {"statement_timeout": statement_timeout}
            )
        if lock_timeout is not None:
            PostgresDatabaseSchemaEditor.execute(
                self, self._sql_set_lock_timeout % {"lock_timeout": lock_timeout}
            )
        yield
        if statement_timeout is not None:
            PostgresDatabaseSchemaEditor.execute(
                self,
                self._sql_set_statement_timeout % {"statement_timeout": previous_statement_timeout},
            )
        if lock_timeout is not None:
            PostgresDatabaseSchemaEditor.execute(
                self, self._sql_set_lock_timeout % {"lock_timeout": previous_lock_timeout}
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
