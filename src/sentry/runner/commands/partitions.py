from __future__ import annotations

from typing import TYPE_CHECKING

import click

from sentry.runner.decorators import configuration

if TYPE_CHECKING:
    from django.db import models


def _selected_models(table: str | None) -> list[type[models.Model]]:
    from sentry.db.partitions.registry import iter_partitioned_models

    selected = [
        model
        for model, _ in iter_partitioned_models()
        if table is None or model._meta.db_table == table
    ]
    if table is not None and not selected:
        raise click.ClickException(f"No model declares partitioning for table {table}.")
    return selected


@click.group()
def partitions() -> None:
    """Inspect and maintain partitioned tables."""


@partitions.command()
@click.option("--table", help="Only show this table.")
@configuration
def status(table: str | None) -> None:
    """Show declared partitioning, the database state and any mismatch."""
    from sentry.db.partitions.catalog import (
        get_connection,
        get_partitioned_table_info,
        list_partitions,
        verify_partition_state,
    )
    from sentry.db.partitions.registry import get_declared_partitioning, is_partitioning_enabled

    for model in _selected_models(table):
        db_table = model._meta.db_table
        connection = get_connection(model)
        info = get_partitioned_table_info(connection, db_table)
        click.echo(f"{db_table}")
        click.echo(f"  declared: {get_declared_partitioning(model)}")
        click.echo(f"  enabled:  {is_partitioning_enabled(db_table)}")
        if info is None:
            click.echo("  database: not partitioned")
            continue
        click.echo(f"  database: {info.strategy} {', '.join(info.key_columns)}")
        for partition in list_partitions(connection, db_table):
            pending = " (detach pending)" if partition.detach_pending else ""
            click.echo(f"    {partition.name}: {partition.bound}{pending}")

    problems = verify_partition_state()
    for problem in problems:
        click.echo(f"PROBLEM: {problem}", err=True)
    if problems:
        raise click.exceptions.Exit(1)


@partitions.command()
@click.option("--table", help="Only this table.")
@configuration
def ensure(table: str | None) -> None:
    """Create the current and upcoming partitions of range partitioned tables."""
    from sentry.db.partitions.manager import ensure_partitions

    for model in _selected_models(table):
        for name in ensure_partitions(model):
            click.echo(f"Created {name}")


@partitions.command()
@click.option("--table", help="Only this table.")
@click.option("--execute", is_flag=True, help="Drop the partitions. Without it, only list them.")
@configuration
def expire(table: str | None, execute: bool) -> None:
    """List, or with --execute drop, partitions older than the declared retention."""
    from sentry.db.partitions.manager import expire_partitions

    verb = "Dropped" if execute else "Would drop"
    for model in _selected_models(table):
        for name in expire_partitions(model, dry_run=not execute):
            click.echo(f"{verb} {name}")
    if not execute:
        click.echo("Dry run. Pass --execute to drop these partitions.")
