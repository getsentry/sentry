from django.db.migrations import Migration, RunSQL
from django_zero_downtime_migrations.backends.postgres.schema import UnsafeOperationException


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

    # This determines whether we allow `RunSQL` to be used in migrations. We want to discourage this going forward,
    # because it's hard for our framework to determine whether SQL is safe. It can also cause problems with setting
    # lock/statement timeouts appropriately.
    allow_run_sql = False

    def apply(self, project_state, schema_editor, collect_sql=False):
        if self.checked:
            schema_editor.safe = True
        for op in self.operations:
            if not self.allow_run_sql and type(op) is RunSQL:
                raise UnsafeOperationException(
                    "Using RunSQL is unsafe because our migrations safety framework can't detect problems with the "
                    "migration. If you need to use RunSQL, set `allow_run_sql = True` and get approval from "
                    "`owners-migrations` to make sure that it's safe."
                )

        return super().apply(project_state, schema_editor, collect_sql)
