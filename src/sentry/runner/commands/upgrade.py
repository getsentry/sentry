import click
from django.conf import settings

from sentry.runner.decorators import configuration


def _upgrade(interactive, traceback, verbosity, repair, with_nodestore):
    from django.core.management import call_command as dj_call_command

    for db_conn in settings.DATABASES.keys():
        # Always run migrations for the default connection.
        # Also run migrations on connections that have migrations explicitly enabled.
        # This is used for sentry.io as our production database runs on multiple hosts.
        if db_conn == "default" or settings.DATABASES[db_conn].get("RUN_MIGRATIONS", False):
            click.echo(f"Running migrations for {db_conn}")
            dj_call_command(
                "migrate",
                database=db_conn,
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
