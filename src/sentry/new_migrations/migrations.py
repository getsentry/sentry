from django.db.migrations import Migration, RunSQL, SeparateDatabaseAndState
from django.db.migrations.state import ProjectState
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

    def mutate_state(self, project_state: ProjectState, preserve: bool = True) -> ProjectState:
        # `SafeDeleteModel`/`SafeRemoveField` with `MOVE_TO_PENDING` render `state.apps`
        # to look up the model. If that rendered registry is left on the state, Django
        # re-renders models on every later state change, so building state from the full
        # migration history (`migrate`, unapplying migrations in tests) takes minutes.
        # Drop it again at the end of the migration unless it was already rendered.
        was_rendered = "apps" in project_state.__dict__
        new_state = super().mutate_state(project_state, preserve)
        if not was_rendered:
            new_state.__dict__.pop("apps", None)
        return new_state


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
