from __future__ import annotations

import os
import signal
import threading
from collections.abc import Sequence
from types import FrameType
from typing import TYPE_CHECKING

import click
from django.conf import settings
from django.db import connections

from sentry.runner.decorators import configuration

if TYPE_CHECKING:
    from django.db.backends.base.base import BaseDatabaseWrapper

# Signals that trigger cancellation of in-flight migration queries.
# Kubernetes sends SIGTERM on pod termination; SIGINT covers Ctrl-C.
CANCEL_SIGNALS = (signal.SIGINT, signal.SIGTERM)

# How often the main thread wakes up to check on the worker thread. While a
# cancellation is pending, cancel requests are re-sent at this interval so that
# a query which started after the previous cancel request is also cancelled.
POLL_INTERVAL = 1.0


class MigrationCancelled(Exception):
    """Raised in the worker thread when a cancel was requested between operations."""


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
    """
    Manually run a single data migration. Will error if the migration is not a post_deploy migration

    Because query execution block in psycopg/libpq, migrations are run in a worker thread.
    This allows the main thread to capture signals and set cancel events, to cancel running
    queries when the process is killed.
    """
    wrappers = connections.all()
    cancel_event = threading.Event()
    received: list[int] = []
    errors: list[BaseException] = []

    def worker_main() -> None:
        # `connections` is a thread local. Bind the main thread's connection
        # wrappers into this thread, so that schema editors and ORM queries
        # from RunPython use connections the main thread can cancel.
        for wrapper in wrappers:
            connections[wrapper.alias] = wrapper
        try:
            run_for_all_connections(app_name, migration_name, cancel_event)
        except BaseException as e:
            errors.append(e)

    def handle_signal(signum: int, frame: FrameType | None) -> None:
        received.append(signum)
        cancel_event.set()
        _cancel_queries(wrappers)

    for wrapper in wrappers:
        wrapper.inc_thread_sharing()
    previous_handlers = {sig: signal.signal(sig, handle_signal) for sig in CANCEL_SIGNALS}

    worker = threading.Thread(target=worker_main, name="sentry-migrations-run", daemon=True)
    announced = False
    try:
        worker.start()
        while worker.is_alive():
            worker.join(timeout=POLL_INTERVAL)
            if cancel_event.is_set():
                if not announced:
                    signame = signal.Signals(received[0]).name
                    click.secho(
                        f"\nReceived {signame}, cancelling running queries...",
                        fg="yellow",
                        err=True,
                    )
                    announced = True
                # A query might have started after the last cancel request.
                _cancel_queries(wrappers)
    finally:
        for sig, handler in previous_handlers.items():
            signal.signal(sig, handler)
        for wrapper in wrappers:
            wrapper.dec_thread_sharing()

    if received:
        click.secho(
            "Migration cancelled. If an index was being built concurrently, it may "
            "have been left INVALID. Check pg_index.indisvalid and drop it before retrying.",
            fg="yellow",
            err=True,
        )
        raise SystemExit(128 + received[0])
    if errors:
        raise errors[0]


def run_for_all_connections(
    app_name: str, migration_name: str, cancel_event: threading.Event
) -> None:
    """
    Run migrations for all connections.
    Called within the worker thread.
    """
    for connection_name in settings.DATABASES.keys():
        if settings.DATABASES[connection_name].get("REPLICA_OF", False):
            continue
        run_for_connection(app_name, migration_name, connection_name, cancel_event)


def run_for_connection(
    app_name: str, migration_name: str, connection_name: str, cancel_event: threading.Event
) -> None:
    """
    Run a migration for single connection.
    """
    # Late import so monkeypatching is applied
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
            if cancel_event.is_set():
                raise MigrationCancelled()

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


def _cancel_queries(wrappers: Sequence[BaseDatabaseWrapper]) -> None:
    """
    Send a libpq cancel request for any query running on the given connections.

    psycopg2's `connection.cancel()` is safe to call from another thread while
    the connection is busy. It opens a short-lived side channel to the server,
    so it doesn't need the busy connection, and pgbouncer forwards it.
    It is a no-op if the connection is idle.
    """
    for wrapper in wrappers:
        raw = wrapper.connection
        if raw is None or raw.closed:
            continue
        try:
            raw.cancel()
        except Exception as e:
            click.secho(f"Failed to cancel query on {wrapper.alias}: {e}", fg="red", err=True)
