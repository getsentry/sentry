"""
Schema editor support for partitioned tables.

``PartitioningSchemaEditorMixin`` adds ``create_partitioned_model``, which
``CreatePartitionedModel`` migrations use to create a partitioned table when the table
is listed in ``SENTRY_PARTITIONED_TABLES``. ``create_model`` only creates partitioned
tables for live models that declare ``__partitioning__``, as when the test database
is built from the models. For every other table the schema editor behaves exactly as
before.

``SafePartitioningSchemaEditorMixin`` adds the rules for changing a table that is
already partitioned. It is only used by the safe (checked migrations) editor.
"""

from __future__ import annotations

import copy
import hashlib
from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager, contextmanager
from dataclasses import dataclass
from datetime import datetime
from typing import Any, cast

from django.db.backends.ddl_references import Statement, Table
from django.db.backends.postgresql.schema import (
    DatabaseSchemaEditor as PostgresDatabaseSchemaEditor,
)
from django.db.backends.utils import truncate_name
from django.db.models import Field, Index, Model, UniqueConstraint
from django.db.models.constraints import BaseConstraint
from django.utils import timezone
from django_zero_downtime_migrations.backends.postgres.schema import (
    PGAccessExclusive,
    PGLock,
    PGShareUpdateExclusive,
    UnsafeOperationException,
)

from sentry.db.partitions import sql
from sentry.db.partitions.catalog import (
    PartitionedTableInfo,
    get_partitioned_table_info,
    list_partitions,
    table_exists,
)
from sentry.db.partitions.registry import (
    get_declared_partitioning,
    get_partition_column,
    is_partitioning_enabled,
    resolve_partitioning,
)
from sentry.db.partitions.spec import (
    MAX_IDENTIFIER_LENGTH,
    HashPartitioning,
    PartitioningSpec,
    RangePartitioning,
    hash_partition_bounds,
    premade_range_partition_bounds,
)
from sentry.db.partitions.validation import (
    DOCS_HINT,
    has_db_constraint,
    validate_model_partitioning,
)

# The zero downtime migrations editor rewrites these into CONCURRENTLY and NOT VALID
# variants, which Postgres rejects on partitioned tables. A partitioned table is
# always created empty, so the plain Postgres statements are safe for it.
_PLAIN_DDL_TEMPLATES = (
    "sql_create_check",
    "sql_create_fk",
    "sql_create_index",
    "sql_create_pk",
    "sql_create_unique",
    "sql_create_unique_index",
)


@dataclass(frozen=True)
class _PartitionedCreate:
    table: str
    spec: PartitioningSpec
    key_column: str
    # Set when the partition key isn't the primary key, so the primary key has to be
    # widened to include it.
    primary_key_columns: tuple[str, ...] | None


def initial_partition_sql(
    quote_name: Callable[[str], str], table: str, spec: PartitioningSpec, now: datetime
) -> list[str]:
    """Statements creating the first partitions of a new, empty partitioned table."""
    if isinstance(spec, HashPartitioning):
        return [
            sql.CREATE_HASH_PARTITION.format(
                partition=quote_name(bound.name),
                table=quote_name(table),
                modulus=bound.modulus,
                remainder=bound.remainder,
            )
            for bound in hash_partition_bounds(table, spec.modulus)
        ]
    return [
        sql.CREATE_RANGE_PARTITION.format(
            partition=quote_name(bound.name),
            table=quote_name(table),
            start=sql.timestamp_literal(bound.start),
            end=sql.timestamp_literal(bound.end),
        )
        for bound in premade_range_partition_bounds(table, spec, now)
    ]


def partition_index_name(index_name: str, partition_name: str) -> str:
    suffix = "_" + hashlib.md5(partition_name.encode(), usedforsecurity=False).hexdigest()[:8]
    return truncate_name(index_name, MAX_IDENTIFIER_LENGTH - len(suffix)) + suffix


def _rewrite_sql(statement: Any, rewrite: Callable[[str], str]) -> Any:
    # The zero downtime migrations editor wraps statements in lock objects that keep
    # the SQL in `.sql`.
    if isinstance(statement, str):
        return rewrite(statement)
    statement = copy.copy(statement)
    statement.sql = rewrite(statement.sql)
    return statement


class PartitioningSchemaEditorMixin(PostgresDatabaseSchemaEditor):
    _partitioned_create: _PartitionedCreate | None = None

    @property
    def created_partitioned_tables(self) -> dict[str, PartitionedTableInfo]:
        """Tables this editor created partitioned, for when SQL is only collected."""
        return self.__dict__.setdefault("_created_partitioned_tables", {})

    def create_model(self, model: type[Model]) -> None:
        # Only live models carry `__partitioning__`, e.g. when the test database is
        # created from the models directly. Migrations pass historical models, which
        # never do, so a plain `CreateModel` always creates a plain table, and only
        # `CreatePartitionedModel` creates a partitioned one.
        spec = get_declared_partitioning(model)
        if spec is None:
            super().create_model(model)
            return
        self.create_partitioned_model(model, spec)

    def create_partitioned_model(self, model: type[Model], spec: PartitioningSpec) -> None:
        """Create ``model``'s table partitioned if this environment lists it."""
        table = model._meta.db_table
        if not is_partitioning_enabled(table):
            super().create_model(model)
            return

        # Checks the model as it is at this point of the migration history.
        validate_model_partitioning(model, spec)
        key_column = get_partition_column(model, spec)
        assert model._meta.pk is not None
        pk_column = model._meta.pk.column
        self._partitioned_create = _PartitionedCreate(
            table=table,
            spec=spec,
            key_column=key_column,
            primary_key_columns=None if key_column == pk_column else (pk_column, key_column),
        )
        try:
            with self._plain_ddl_templates():
                super().create_model(model)
        finally:
            self._partitioned_create = None

        for statement in initial_partition_sql(self.quote_name, table, spec, timezone.now()):
            self.execute(statement)
        self.created_partitioned_tables[table] = PartitionedTableInfo(
            "range" if isinstance(spec, RangePartitioning) else "hash", (key_column,)
        )

    @contextmanager
    def _plain_ddl_templates(self) -> Iterator[None]:
        for name in _PLAIN_DDL_TEMPLATES:
            self.__dict__[name] = getattr(PostgresDatabaseSchemaEditor, name)
        try:
            yield
        finally:
            for name in _PLAIN_DDL_TEMPLATES:
                self.__dict__.pop(name, None)

    def _creating_partitioned(self, model: type[Model]) -> _PartitionedCreate | None:
        plan = self._partitioned_create
        if plan is None or model._meta.db_table != plan.table:
            return None
        return plan

    def table_sql(self, model: type[Model]) -> tuple[Any, Any]:
        statement, params = super().table_sql(model)
        plan = self._creating_partitioned(model)
        if plan is None:
            return statement, params
        return _rewrite_sql(statement, lambda s: self._partitioned_table_sql(s, plan)), params

    def _partitioned_table_sql(self, statement: str, plan: _PartitionedCreate) -> str:
        if not statement.endswith(")"):
            raise ValueError(f"Unexpected CREATE TABLE statement for {plan.table}: {statement}")
        if plan.primary_key_columns is not None:
            primary_key = sql.PRIMARY_KEY_CONSTRAINT.format(
                name=self.quote_name(truncate_name(f"{plan.table}_pkey", MAX_IDENTIFIER_LENGTH)),
                columns=", ".join(self.quote_name(c) for c in plan.primary_key_columns),
            )
            statement = f"{statement[:-1]}, {primary_key})"
        return statement + sql.PARTITION_BY.format(
            method=plan.spec.method, columns=self.quote_name(plan.key_column)
        )

    def _iter_column_sql(
        self,
        column_db_type: str,
        params: list[Any],
        model: type[Model],
        field: Field[Any, Any],
        field_db_params: dict[str, Any],
        include_default: bool,
    ) -> Iterator[str]:
        parts = super()._iter_column_sql(  # type: ignore[misc]
            column_db_type, params, model, field, field_db_params, include_default
        )
        plan = self._creating_partitioned(model)
        if plan is None or plan.primary_key_columns is None or not field.primary_key:
            yield from parts
            return
        # The primary key is added as a table constraint that includes the partition key.
        for part in parts:
            if part != "PRIMARY KEY":
                yield part


_DELETE_INDEX_TEMPLATES = ("sql_delete_index", "sql_delete_index_concurrently")
_DEFAULT_LOCK_TIMEOUT = sql.DEFAULT_LOCK_TIMEOUT


class _PartitionedIndexDrop(PGLock):
    """Template of a ``DROP INDEX`` on a partitioned table, see ``execute``."""


def _statement(template: PGLock, **parts: Any) -> Statement:
    # The zero downtime migrations editor runs statements built from lock templates with
    # that lock's timeout handling.
    return Statement(cast(Any, template), **parts)


def _has_db_index(field: Field[Any, Any]) -> bool:
    return bool(getattr(field, "db_index", False))


def _unsafe(message: str) -> UnsafeOperationException:
    return UnsafeOperationException(f"{message}\n{DOCS_HINT}")


class SafePartitioningSchemaEditorMixin(PartitioningSchemaEditorMixin):
    # Provided by the zero downtime migrations editor this is mixed into.
    LOCK_TIMEOUT: str | None
    STATEMENT_TIMEOUT: str | None
    _set_operation_timeout: Callable[..., AbstractContextManager[None]]

    def _partitioned_table_info(self, model: type[Model]) -> PartitionedTableInfo | None:
        # Partitioned tables are only ever created from a declaration, so tables without
        # one skip the catalog lookups.
        if resolve_partitioning(model) is None:
            return None
        table = model._meta.db_table
        info = get_partitioned_table_info(self.connection, table)
        if info is not None or table_exists(self.connection, table):
            return info
        # The table doesn't exist yet, e.g. when collecting SQL for `sqlmigrate`.
        return self.created_partitioned_tables.get(table)

    def add_index(self, model: type[Model], index: Index, concurrently: bool = False) -> None:
        if self._partitioned_table_info(model) is None:
            super().add_index(model, index, concurrently=concurrently)
            return
        self._add_partitioned_index(model, index)

    def _add_partitioned_index(self, model: type[Model], index: Index) -> None:
        """
        ``CREATE INDEX CONCURRENTLY`` doesn't work on a partitioned table. Instead the
        index is created on the parent only (it starts out invalid), built
        concurrently on each partition and attached. The parent index becomes valid
        once every partition has an attached index. Each step is skipped if it was
        already done, so a failed migration can be re-run.
        """
        table = model._meta.db_table
        if self.connection.in_atomic_block and not self.collect_sql:
            raise _unsafe(
                f"Adding index {index.name} to partitioned table {table} builds it "
                f"concurrently on each partition, which can't run in a transaction. "
                f"Use a non-atomic migration."
            )
        parent = index.create_sql(model, self, sql=PGAccessExclusive(sql.CREATE_INDEX_ON_ONLY))
        self.execute(parent)
        for partition in list_partitions(self.connection, table):
            if partition.detach_pending:
                continue
            with self.connection.cursor() as cursor:
                cursor.execute(sql.ATTACHED_PARTITION_INDEX, [index.name, partition.name])
                if cursor.fetchone() is not None:
                    continue
                child = partition_index_name(index.name, partition.name)
                cursor.execute(sql.INDEX_IS_VALID, [child])
                row = cursor.fetchone()
            if row is not None and not row[0]:
                # Left behind by an interrupted concurrent build.
                self.execute(
                    _statement(
                        PGShareUpdateExclusive(
                            sql.DROP_INDEX_CONCURRENTLY.format(name=self.quote_name(child))
                        )
                    )
                )
            if row is None or not row[0]:
                self.execute(
                    _statement(
                        PGShareUpdateExclusive(sql.CREATE_INDEX_CONCURRENTLY),
                        **{
                            **parent.parts,
                            "table": Table(partition.name, self.quote_name),
                            "name": self.quote_name(child),
                        },
                    )
                )
            self.execute(
                _statement(
                    PGAccessExclusive(
                        sql.ATTACH_INDEX.format(
                            parent=self.quote_name(index.name), child=self.quote_name(child)
                        )
                    )
                )
            )

    @contextmanager
    def partitioned_index_drops(self, model: type[Model]) -> Iterator[None]:
        """
        Drop indexes of a partitioned table with a plain ``DROP INDEX``.

        Partitioned indexes can't be dropped concurrently, and Postgres rejects the
        zero downtime migrations editor's ``DROP INDEX CONCURRENTLY``. Every index drop
        (removing an index, an indexed field's index or a unique constraint backed by
        an index) is built from these two templates, so they are swapped for the
        operation. The plain drop takes an ACCESS EXCLUSIVE lock on the table and all
        of its partitions, and every query queues behind it while it waits, so
        ``execute`` always runs it with a lock timeout.
        """
        if self._partitioned_table_info(model) is None:
            yield
            return
        for name in _DELETE_INDEX_TEMPLATES:
            self.__dict__[name] = _PartitionedIndexDrop(sql.DROP_INDEX)
        try:
            yield
        finally:
            for name in _DELETE_INDEX_TEMPLATES:
                self.__dict__.pop(name, None)

    def execute(self, sql: Any, params: Any = ()) -> None:
        template = sql.template if isinstance(sql, Statement) else sql
        if not isinstance(template, _PartitionedIndexDrop):
            super().execute(sql, params)
            return
        statement = (
            Statement(template.sql, **sql.parts) if isinstance(sql, Statement) else template.sql
        )
        lock_timeout = self.LOCK_TIMEOUT or _DEFAULT_LOCK_TIMEOUT
        with self._set_operation_timeout(self.STATEMENT_TIMEOUT, lock_timeout):
            super().execute(statement, params)

    def remove_index(self, model: type[Model], index: Index, concurrently: bool = False) -> None:
        with self.partitioned_index_drops(model):
            super().remove_index(model, index, concurrently=concurrently)

    def remove_constraint(self, model: type[Model], constraint: BaseConstraint) -> None:
        with self.partitioned_index_drops(model):
            super().remove_constraint(model, constraint)

    def alter_index_together(
        self,
        model: type[Model],
        old_index_together: Any,
        new_index_together: Any,
    ) -> None:
        with self.partitioned_index_drops(model):
            super().alter_index_together(model, old_index_together, new_index_together)

    def add_constraint(self, model: type[Model], constraint: BaseConstraint) -> None:
        if isinstance(constraint, UniqueConstraint) and self._partitioned_table_info(model):
            raise _unsafe(
                f"Adding unique constraint {constraint.name} to partitioned table "
                f"{model._meta.db_table} is not supported: Postgres can't build it "
                f"concurrently on a partitioned table."
            )
        super().add_constraint(model, constraint)

    def alter_unique_together(
        self,
        model: type[Model],
        old_unique_together: Any,
        new_unique_together: Any,
    ) -> None:
        added = {tuple(f) for f in new_unique_together} - {tuple(f) for f in old_unique_together}
        if added and self._partitioned_table_info(model):
            raise _unsafe(
                f"Adding unique_together {sorted(added)} to partitioned table "
                f"{model._meta.db_table} is not supported: Postgres can't build it "
                f"concurrently on a partitioned table."
            )
        with self.partitioned_index_drops(model):
            super().alter_unique_together(model, old_unique_together, new_unique_together)

    def _check_partitioned_add_field(self, model: type[Model], field: Field[Any, Any]) -> None:
        if self._partitioned_table_info(model) is None:
            return
        name = f"{model.__name__}.{field.name}"
        table = model._meta.db_table
        if field.unique:
            raise _unsafe(f"Adding unique field {name} to partitioned table {table} is unsafe.")
        if has_db_constraint(field):
            raise _unsafe(
                f"Adding foreign key {name} to partitioned table {table} is unsafe: Postgres 14 "
                f"can't add a NOT VALID foreign key to a partitioned table, so it would block "
                f"writes while every partition is checked. Use `db_constraint=False`."
            )
        if _has_db_index(field):
            raise _unsafe(
                f"Adding indexed field {name} to partitioned table {table} is unsafe. Add it "
                f"with `db_index=False`, then add the index with `AddIndex`, which is built "
                f"concurrently on each partition."
            )

    def _check_partitioned_alter_field(
        self, model: type[Model], old_field: Field[Any, Any], new_field: Field[Any, Any]
    ) -> None:
        info = self._partitioned_table_info(model)
        if info is None:
            return
        name = f"{model.__name__}.{old_field.name}"
        table = model._meta.db_table
        if old_field.column in info.key_columns or new_field.column in info.key_columns:
            old_type = old_field.db_parameters(connection=self.connection)["type"]
            new_type = new_field.db_parameters(connection=self.connection)["type"]
            if (
                old_type != new_type
                or old_field.null != new_field.null
                or old_field.column != new_field.column
            ):
                raise _unsafe(f"{name} is the partition key of {table} and can't be altered.")
        if new_field.unique and not old_field.unique:
            raise _unsafe(f"Making {name} unique on partitioned table {table} is unsafe.")
        if has_db_constraint(new_field) and not has_db_constraint(old_field):
            raise _unsafe(
                f"Adding a foreign key constraint to {name} on partitioned table {table} is "
                f"unsafe: Postgres 14 can't add a NOT VALID foreign key to a partitioned table."
            )
        if _has_db_index(new_field) and not _has_db_index(old_field):
            raise _unsafe(
                f"Adding db_index to {name} on partitioned table {table} is unsafe. Add an "
                f"index with `AddIndex` instead, which is built concurrently on each partition."
            )
