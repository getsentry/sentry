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

    from django.apps import apps
    from django.db import connections
    from django.db.migrations import RunPython
    from django.db.migrations.executor import MigrationExecutor

    migration = MigrationExecutor(connections["default"]).loader.get_migration_by_prefix(
        app_name, migration_name
    )
    for op in migration.operations:
        if not isinstance(op, RunPython):
            raise click.ClickException(
                "Migration must contain only RunPython ops, found: %s" % type(op).__name__
            )

    for op in migration.operations:
        op.code(apps, None)
