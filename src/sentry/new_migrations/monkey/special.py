from django.conf import settings
from django.db.migrations.operations.special import RunSQL


class SafeRunSQL(RunSQL):
    def __init__(self, *args, use_statement_timeout=True, **kwargs):
        super().__init__(*args, **kwargs)
        self.use_statement_timeout = use_statement_timeout

    def _run_sql(self, schema_editor, sqls):
        use_statement_timeout = (
            settings.ZERO_DOWNTIME_MIGRATIONS_STATEMENT_TIMEOUT is not None
            and self.use_statement_timeout  # type: ignore[unreachable]
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
