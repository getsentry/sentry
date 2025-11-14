from typing import int
from django.db.migrations import Migration, RunSQL, SeparateDatabaseAndState
from django_zero_downtime_migrations.backends.postgres.schema import UnsafeOperationException

from sentry.new_migrations.monkey.special import SafeRunSQL


class CheckedMigration(Migration):
    """
    Migrations subclassing this will perform safety checks to help ensure that they
    won't cause production issues during deploy.
    """

    # This flag is used to decide whether to run this migration in a transaction or not. Generally
    # we don't want to run in a transaction here, since for long running operations like data
    # back-fills this results in us locking an increasing number of rows until we finally commit.
    atomic = False

    # This can be set to `False` to disable safety checks. Don't do this without approval from
    # the `owners-migrations` team.
    checked = True

    def apply(self, project_state, schema_editor, collect_sql=False):
        if self.checked:
            schema_editor.safe = True
        for op in self.operations:
            validate_operation(op)

        return super().apply(project_state, schema_editor, collect_sql)


def validate_operation(op):
    if isinstance(op, RunSQL) and not isinstance(op, SafeRunSQL):
        raise UnsafeOperationException(
            "Using `RunSQL` is unsafe because our migrations safety framework can't detect problems with the "
            "migration, and doesn't apply timeout and statement locks. Use `SafeRunSQL` instead, and get "
            "approval from `owners-migrations` to make sure that it's safe."
        )

    if isinstance(op, SeparateDatabaseAndState):
        for db_op in op.database_operations:
            validate_operation(db_op)
