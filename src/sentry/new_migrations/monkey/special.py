from collections.abc import Mapping, Sequence
from typing import Any, TypeAlias, cast

from django.conf import settings
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.operations.base import Operation
from django.db.migrations.operations.special import RunSQL

SqlArgument: TypeAlias = dict[str, object] | list[object] | tuple[object, ...] | None
SqlSpec: TypeAlias = str | tuple[str, SqlArgument]
SqlOperations: TypeAlias = str | Sequence[SqlSpec]


class SafeRunSQL(RunSQL):
    def __init__(
        self,
        sql: SqlOperations,
        reverse_sql: SqlOperations | None = None,
        state_operations: Sequence[Operation] | None = None,
        hints: Mapping[str, object] | None = None,
        elidable: bool = False,
        use_statement_timeout: bool = True,
    ) -> None:
        super().__init__(cast(Any, sql), cast(Any, reverse_sql), state_operations, hints, elidable)
        self.use_statement_timeout = use_statement_timeout

    def _run_sql(self, schema_editor: BaseDatabaseSchemaEditor, sqls: SqlOperations) -> None:
        use_statement_timeout = (
            settings.ZERO_DOWNTIME_MIGRATIONS_STATEMENT_TIMEOUT is not None
            and self.use_statement_timeout
        )
        use_lock_timeout = settings.ZERO_DOWNTIME_MIGRATIONS_LOCK_TIMEOUT is not None
        if use_statement_timeout:
            schema_editor.execute(
                "SET statement_timeout TO %s;",
                params=(settings.ZERO_DOWNTIME_MIGRATIONS_STATEMENT_TIMEOUT,),
            )
        if use_lock_timeout:
            schema_editor.execute(
                "SET lock_timeout TO %s;", params=(settings.ZERO_DOWNTIME_MIGRATIONS_LOCK_TIMEOUT,)
            )
        super()._run_sql(schema_editor, sqls)  # type: ignore[misc]
        if use_lock_timeout:
            schema_editor.execute("SET lock_timeout TO '0ms';", params=None)
        if use_statement_timeout:
            schema_editor.execute("SET statement_timeout TO '0ms';", params=None)
