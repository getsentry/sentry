import click
from django.conf import settings
from django.db import connections
from django.db.utils import ProgrammingError

from sentry.runner.decorators import configuration
from sentry.signals import post_upgrade
from sentry.silo.base import SiloMode


def _check_history() -> None:
    connection = connections["default"]
    cursor = connection.cursor()
    try:
        # If this query fails because there are no tables we're good to go.
        cursor.execute("SELECT COUNT(*) FROM django_migrations")
        row = cursor.fetchone()
        if not row or row[0] == 0:
            return
    except ProgrammingError as e:
        # Having no migrations table is ok, as we're likely operating on a new install.
        if 'relation "django_migrations" does not exist' in str(e):
            return
        click.echo(f"Checking migration state failed with: {e}")
        raise click.ClickException("Could not determine migration state. Aborting")

    # Either of these migrations need to have been run for us to proceed.
    migration_heads = (
        # not a squash, but migration history was "rebased" before this to eliminate
        # `index_together` for django 5.1 upgrade
        "0642_index_together_release",
    )

    # If we haven't run all the migration up to the latest squash abort.
    # As we squash more history this should be updated.
    cursor.execute("SELECT 1 FROM django_migrations WHERE name in %s", [migration_heads])
    row = cursor.fetchone()
    if not row or not row[0]:
        raise click.ClickException(
            "It looks like you've skipped a hard stop in our upgrade process. "
            "Please follow the upgrade process here: https://develop.sentry.dev/self-hosted/releases/#hard-stops"
        )


def _upgrade(
    interactive: bool,
    traceback: bool,
    verbosity: int,
    repair: bool,
    run_post_upgrade: bool,
    with_nodestore: bool,
    create_kafka_topics: bool,
) -> None:
    from django.core.management import call_command as dj_call_command

    _check_history()

    for db_conn in settings.DATABASES.keys():
        # Run migrations on all non-read replica connections.
        # This is used for sentry.io as our production database runs on multiple hosts.
        if not settings.DATABASES[db_conn].get("REPLICA_OF", False):
            click.echo(f"Running migrations for {db_conn}")
            dj_call_command(
                "migrate",
                database=db_conn,
                interactive=interactive,
                traceback=traceback,
                verbosity=verbosity,
            )

    if with_nodestore:
        from sentry import nodestore

        nodestore.backend.bootstrap()

    if create_kafka_topics:
        from sentry.conf.types.kafka_definition import Topic
        from sentry.utils.batching_kafka_consumer import create_topics
        from sentry.utils.kafka_config import get_topic_definition

        for topic in Topic:
            topic_defn = get_topic_definition(topic)
            create_topics(topic_defn["cluster"], [topic_defn["real_topic_name"]])

    if repair:
        from sentry.runner import call_command

        call_command("sentry.runner.commands.repair.repair")

    if run_post_upgrade:
        post_upgrade.send(sender=SiloMode.get_current_mode(), interactive=interactive)


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
@click.option(
    "--no-post-upgrade",
    default=False,
    is_flag=True,
    help="Skip post migration database initialization.",
)
@click.option("--with-nodestore", default=False, is_flag=True, help="Bootstrap nodestore.")
@click.option("--create-kafka-topics", default=False, is_flag=True, help="Create kafka topics.")
@configuration
def upgrade(
    verbosity: int,
    traceback: bool,
    noinput: bool,
    lock: bool,
    no_repair: bool,
    no_post_upgrade: bool,
    with_nodestore: bool,
    create_kafka_topics: bool,
) -> None:
    "Perform any pending database migrations and upgrades."

    if lock:
        from sentry.locks import locks
        from sentry.utils.locking import UnableToAcquireLock

        lock_inst = locks.get("upgrade", duration=0, name="command_upgrade")
        try:
            with lock_inst.acquire():
                _upgrade(
                    not noinput,
                    traceback,
                    verbosity,
                    not no_repair,
                    not no_post_upgrade,
                    with_nodestore,
                    create_kafka_topics,
                )
        except UnableToAcquireLock:
            raise click.ClickException("Unable to acquire `upgrade` lock.")
    else:
        _upgrade(
            not noinput,
            traceback,
            verbosity,
            not no_repair,
            not no_post_upgrade,
            with_nodestore,
            create_kafka_topics,
        )
