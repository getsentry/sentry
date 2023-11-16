import click

from sentry.runner.decorators import configuration


def info(*msg: str, end="\n"):
    """Send a message to the user and/or logging."""
    from sys import stderr

    print(*msg, file=stderr, flush=True, end=end)


@click.group()
def migrations():
    "Manage migrations."


@migrations.command()
@click.argument("app_name")
@click.argument("migration_name")
@configuration
@click.pass_context
def run(ctx, app_name, migration_name):
    "Manually run a single data migration. Will error if migration is not data only."
    del ctx  # assertion: unused argument

    from django.db import connection, connections
    from django.db.migrations.executor import MigrationExecutor

    executor = MigrationExecutor(connections["default"])
    migration = executor.loader.get_migration_by_prefix(app_name, migration_name)
    if not getattr(migration, "is_dangerous", None):
        raise click.ClickException(
            f"This is not a post-deployment migration: {migration.name}\n"
            "Please use `make apply-migrations` to apply."
        )

    # state = self.project_state((migration.app_label, migration.name), at_end=false)

    project_state = executor.loader.project_state(
        nodes=(migration.app_label, migration.name),
        at_end=False,
    )
    info("Running post-deployment migration:")
    info(" ", migration.name)
    with connection.schema_editor() as schema_editor:
        for op in migration.operations:
            info("    *", op.describe(), end="... ")
            new_state = project_state.clone()

            op.state_forwards(migration.app_label, new_state)
            op.database_forwards(
                app_label=migration.app_label,
                schema_editor=schema_editor,
                from_state=project_state,
                to_state=new_state,
            )
            info("OK")

            project_state = new_state
    info("Migration complete.")
