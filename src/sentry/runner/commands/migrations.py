import click

from sentry.runner.decorators import configuration


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
            f"To apply this migration, please run: make apply-migrations"
        )

    project_state = executor.loader.project_state(
        nodes=[(migration.app_label, migration.name)],
        at_end=False,
    )

    click.secho("Running post-deployment migration:", fg="cyan")
    click.secho(f"  {migration.name}", bold=True)
    with connection.schema_editor() as schema_editor:
        for op in migration.operations:
            click.echo(f"    * {op.describe()}... ", nl=False)
            new_state = project_state.clone()

            try:
                op.state_forwards(migration.app_label, new_state)
                op.database_forwards(
                    app_label=migration.app_label,
                    schema_editor=schema_editor,
                    from_state=project_state,
                    to_state=new_state,
                )
            except BaseException:
                click.secho("FAIL", fg="red", bold=True)
                raise
            else:
                click.secho("OK", fg="green", bold=True)

            project_state = new_state
    click.secho("Migration complete.", fg="cyan")
