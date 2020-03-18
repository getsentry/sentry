from __future__ import absolute_import, print_function

import click
import six

from django.db import connections, ProgrammingError
from django.conf import settings
from sentry.runner.decorators import configuration

# List of migrations which we'll fake if we're coming from South
DJANGO_MIGRATIONS = (
    ("contenttypes", "0001_initial"),
    # Note that we need to have ops make the `django_content_type.name` column nullable.
    # This migration removes the column in the same migration, which will likely take
    # sentry down.
    ("contenttypes", "0002_remove_content_type_name"),
    ("auth", "0001_initial"),
    ("auth", "0002_alter_permission_name_max_length"),
    ("auth", "0003_alter_user_email_max_length"),
    ("auth", "0004_alter_user_username_opts"),
    ("auth", "0005_alter_user_last_login_null"),
    ("auth", "0006_require_contenttypes_0002"),
    ("sites", "0001_initial"),
    ("admin", "0001_initial"),
    ("sessions", "0001_initial"),
)


def _has_applied_django_migration(connection, app_name, migration):
    cursor = connection.cursor()
    try:
        cursor.execute(
            "SELECT 1 FROM django_migrations WHERE app = %s AND name = %s LIMIT 1",
            [app_name, migration],
        )
    except ProgrammingError as exc:
        if 'relation "django_migrations" does not exist' in six.text_type(exc):
            return False
        raise
    else:
        return bool(cursor.fetchall())
    finally:
        cursor.close()


def _has_applied_south_migration(connection, app_name, migration):
    if migration is None:
        return True
    cursor = connection.cursor()
    try:
        cursor.execute(
            "SELECT 1 FROM south_migrationhistory WHERE app_name = %s AND migration = %s LIMIT 1",
            [app_name, migration],
        )
        return bool(cursor.fetchall())
    finally:
        cursor.close()


def _fake_django_migration(connection, app_name, migration, verbosity=0):
    if _has_applied_django_migration(connection, app_name, migration):
        return False

    if verbosity:
        click.echo("Faking migration for {}.{}".format(app_name, migration))

    cursor = connection.cursor()
    try:
        cursor.execute(
            "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, NOW())",
            [app_name, migration],
        )
    finally:
        cursor.close()


def _has_south_history(connection):
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT 1 FROM south_migrationhistory LIMIT 1")
    except ProgrammingError as exc:
        if 'relation "south_migrationhistory" does not exist' in six.text_type(exc):
            return False
        raise
    return True


def _migrate_from_south(verbosity):
    from django.db.migrations.recorder import MigrationRecorder

    connection = connections["default"]

    if not _has_south_history(connection):
        return

    # ensure the django_migrations relation exists
    recorder = MigrationRecorder(connection)
    recorder.ensure_schema()

    for django_app_name, django_migration in DJANGO_MIGRATIONS:
        _fake_django_migration(connection, django_app_name, django_migration, verbosity)

    for (
        south_app_name,
        south_migration,
        django_app_name,
        django_migration,
        south_migration_required,
        south_migration_required_error,
    ) in settings.SOUTH_MIGRATION_CONVERSIONS:
        if _has_applied_south_migration(connection, south_app_name, south_migration):
            _fake_django_migration(connection, django_app_name, django_migration)
        elif south_migration_required:
            raise Exception(south_migration_required_error)


def _upgrade(interactive, traceback, verbosity, repair, with_nodestore):
    from django.core.management import call_command as dj_call_command

    # migrate legacy south history into new django migrations automatically
    _migrate_from_south(verbosity)

    dj_call_command(
        "migrate",
        interactive=interactive,
        traceback=traceback,
        verbosity=verbosity,
        migrate=True,
        merge=True,
        ignore_ghost_migrations=True,
    )

    if with_nodestore:
        from sentry import nodestore

        nodestore.bootstrap()

    if repair:
        from sentry.runner import call_command

        call_command("sentry.runner.commands.repair.repair")


@click.command()
@click.option("--verbosity", "-v", default=1, help="Verbosity level.")
@click.option("--traceback", default=True, is_flag=True, help="Raise on exception.")
@click.option(
    "--noinput", default=False, is_flag=True, help="Do not prompt the user for input of any kind."
)
@click.option(
    "--lock",
    default=False,
    is_flag=True,
    help="Hold a global lock and limit upgrade to one concurrent.",
)
@click.option("--no-repair", default=False, is_flag=True, help="Skip repair step.")
@click.option("--with-nodestore", default=False, is_flag=True, help="Bootstrap nodestore.")
@configuration
@click.pass_context
def upgrade(ctx, verbosity, traceback, noinput, lock, no_repair, with_nodestore):
    "Perform any pending database migrations and upgrades."

    if lock:
        from sentry.app import locks
        from sentry.utils.locking import UnableToAcquireLock

        lock = locks.get("upgrade", duration=0)
        try:
            with lock.acquire():
                _upgrade(not noinput, traceback, verbosity, not no_repair, with_nodestore)
        except UnableToAcquireLock:
            raise click.ClickException("Unable to acquire `upgrade` lock.")
    else:
        _upgrade(not noinput, traceback, verbosity, not no_repair, with_nodestore)
