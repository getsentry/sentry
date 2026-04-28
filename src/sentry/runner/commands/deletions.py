from __future__ import annotations

from typing import TYPE_CHECKING, Any

import click

from sentry.runner.decorators import configuration

if TYPE_CHECKING:
    from sentry.deletions.models.scheduleddeletion import BaseScheduledDeletion


def _query_all(**filters: Any) -> list[BaseScheduledDeletion]:
    from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion, ScheduledDeletion
    from sentry.silo.base import SiloLimit

    results: list[BaseScheduledDeletion] = []
    for model_cls in [ScheduledDeletion, CellScheduledDeletion]:
        try:
            results.extend(model_cls.objects.filter(**filters))
        except SiloLimit.AvailabilityError:
            continue
    return results


@click.group()
def deletions() -> None:
    """
    Utilities to manage scheduled deletions locally.
    """


@deletions.command("list")
@click.option(
    "-m",
    "--model",
    help="Filter by model name (e.g. OrganizationIntegration)",
    default=None,
)
@configuration
def list_deletions(model: str | None) -> None:
    """
    List pending scheduled deletions.
    """
    filters: dict[str, Any] = {}
    if model:
        filters["model_name"] = model

    deletions_list = _query_all(**filters)
    if not deletions_list:
        click.echo("No pending deletions found.")
        return

    click.echo(
        f"\n{'Table':<26} {'ID':<8} {'Model':<30} {'Object ID':<12} {'In Progress':<14} {'Scheduled'}"
    )
    click.echo("-" * 116)
    for d in deletions_list:
        click.echo(
            f"{type(d).__name__:<26} {d.id:<8} {d.model_name:<30} {d.object_id:<12} {str(d.in_progress):<14} {d.date_scheduled}"
        )


@deletions.command("run")
@click.option(
    "-i", "--id", "deletion_id", type=int, help="ScheduledDeletion object ID to run", default=None
)
@click.option(
    "--cid",
    "cell_deletion_id",
    type=int,
    help="CellScheduledDeletion object ID to run",
    default=None,
)
@click.option(
    "-m",
    "--model",
    help="Run all pending deletions for a model name (e.g. OrganizationIntegration)",
    default=None,
)
@click.option("--all", "run_all", is_flag=True, help="Run all pending deletions")
@click.option("-v", "--verbose", is_flag=True, help="Show full tracebacks on failure")
@configuration
def run_deletions(
    deletion_id: int | None,
    cell_deletion_id: int | None,
    model: str | None,
    run_all: bool,
    verbose: bool,
) -> None:
    """
    Run pending scheduled deletions synchronously.
    """
    from django.utils import timezone

    if not any([deletion_id, cell_deletion_id, model, run_all]):
        raise click.UsageError(
            "Provide one of: --id, --cid, --model, or --all. "
            "Use `sentry deletions list` to see pending deletions."
        )

    if deletion_id or cell_deletion_id:
        from sentry.deletions.models.scheduleddeletion import (
            CellScheduledDeletion,
            ScheduledDeletion,
        )
        from sentry.silo.base import SiloLimit

        model_cls: type[BaseScheduledDeletion]
        if cell_deletion_id:
            model_cls, target_id = CellScheduledDeletion, cell_deletion_id
        else:
            assert deletion_id is not None
            model_cls, target_id = ScheduledDeletion, deletion_id

        try:
            deletion = model_cls.objects.get(id=target_id)
        except (
            ScheduledDeletion.DoesNotExist,
            CellScheduledDeletion.DoesNotExist,
            SiloLimit.AvailabilityError,
        ):
            click.echo(f"Deletion with ID {target_id} not found in {model_cls.__name__}.")
            return
        _run_one(deletion=deletion, verbose=verbose)
        return

    filters: dict[str, Any] = {
        "in_progress": False,
        "date_scheduled__lte": timezone.now(),
    }
    if model:
        filters["model_name"] = model

    deletions_list = _query_all(**filters)
    if not deletions_list:
        click.echo("No pending deletions found.")
        return

    click.echo(f"Running {len(deletions_list)} deletion(s)...")
    for d in deletions_list:
        _run_one(deletion=d, verbose=verbose)


def _run_one(*, deletion: BaseScheduledDeletion, verbose: bool = False) -> None:
    from django.core.exceptions import ObjectDoesNotExist

    from sentry import deletions as deletions_module
    from sentry.signals import pending_delete

    click.echo(f"Running deletion {deletion.id} ({deletion.model_name} #{deletion.object_id})...")
    try:
        instance = deletion.get_instance()
    except ObjectDoesNotExist:
        click.echo("  Object already deleted, cleaning up scheduled deletion.")
        deletion.delete()
        return

    task = deletions_module.get(
        model=deletion.get_model(),
        query={"id": deletion.object_id},
        transaction_id=deletion.guid,
        actor_id=deletion.actor_id,
    )

    if not task.should_proceed(instance):
        click.echo("  Deletion aborted (should_proceed returned False).")
        deletion.delete()
        return

    actor = deletion.get_actor()
    pending_delete.send(sender=type(instance), instance=instance, actor=actor)

    try:
        has_more = True
        while has_more:
            has_more = task.chunk()
        deletion.delete()
        click.echo("  Done.")
    except Exception as e:
        if verbose:
            import traceback

            click.echo(f"  Failed:\n{traceback.format_exc()}", err=True)
        else:
            click.echo(f"  Failed: {e}", err=True)
        click.echo("  Deletion record preserved for retry. Re-run to continue.")
