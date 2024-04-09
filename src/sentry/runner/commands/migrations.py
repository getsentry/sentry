import os

import click
from django.conf import settings

from sentry.runner.decorators import configuration


@click.group()
@configuration
def migrations() -> None:
    from sentry.runner.initializer import monkeypatch_django_migrations

    # Include our monkeypatches for migrations.
    monkeypatch_django_migrations()

    # Allow dangerous/postdeploy migrations to be run.
    os.environ["MIGRATION_SKIP_DANGEROUS"] = "0"


@migrations.command()
@click.argument("app_name")
@click.argument("migration_name")
def run(app_name: str, migration_name: str) -> None:
    "Manually run a single data migration. Will error if migration is not post-deploy/dangerous"
    for connection_name in settings.DATABASES.keys():
        if settings.DATABASES[connection_name].get("REPLICA_OF", False):
            continue
        run_for_connection(app_name, migration_name, connection_name)


def run_for_connection(app_name: str, migration_name: str, connection_name: str) -> None:
    from django.db import connections
    from django.db.migrations.executor import MigrationExecutor

    connection = connections[connection_name]
    executor = MigrationExecutor(connection)
    migration = executor.loader.get_migration_by_prefix(app_name, migration_name)
    if not getattr(migration, "is_dangerous", None) and not getattr(
        migration, "is_post_deployment", None
    ):
        raise click.ClickException(
            f"This is not a post-deployment migration: {migration.name}\n"
            f"To apply this migration, please run: make apply-migrations"
        )

    project_state = executor.loader.project_state(
        nodes=[(migration.app_label, migration.name)],
        at_end=False,
    )

    click.secho(f"Running post-deployment migration for {connection_name}:", fg="cyan")
    click.secho(f"  {migration.name}", bold=True)
    with connection.schema_editor() as schema_editor:
        # Enable 'safe' migration execution. This enables concurrent mode on index creation
        setattr(schema_editor, "safe", True)

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
