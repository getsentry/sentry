from collections.abc import Sequence
from typing import Any

from django.db.models import Field, Model

class Unsafe:
    ADD_COLUMN_NOT_NULL: Any
    ALTER_COLUMN_TYPE: Any
    ADD_CONSTRAINT_EXCLUDE: Any
    ALTER_TABLE_SET_TABLESPACE: Any
    ALTER_TABLE_RENAME_COLUMN: Any

class UnsafeOperationException(Exception): ...

class PGLock:
    sql: str
    def __init__(
        self,
        sql: str,
        *,
        use_timeouts: bool = ...,
        disable_statement_timeout: bool = ...,
        idempotent_condition: str | None = ...,
    ) -> None: ...
    def __mod__(self, other: object) -> PGLock: ...
    def format(self, *args: object, **kwargs: object) -> PGLock: ...

class PGAccessExclusive(PGLock): ...

class DatabaseSchemaEditorMixin:
    def _create_index_name(
        self, table_name: str, column_names: Sequence[str], suffix: str = ...
    ) -> str: ...
    def _alter_column_drop_not_null(
        self, model: type[Model], new_field: Field[Any, Any]
    ) -> tuple[str, list[Any]]: ...
