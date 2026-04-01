import click

from sentry.runner.decorators import configuration


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
    from sentry.deletions.models.scheduleddeletion import ScheduledDeletion

    queryset = ScheduledDeletion.objects.all()
    if model:
        queryset = queryset.filter(model_name=model)

    deletions_list = list(queryset)
    if not deletions_list:
        click.echo("No pending deletions found.")
        return

    click.echo(f"\n{'ID':<8} {'Model':<30} {'Object ID':<12} {'In Progress':<14} {'Scheduled'}")
    click.echo("-" * 90)
    for d in deletions_list:
        click.echo(
            f"{d.id:<8} {d.model_name:<30} {d.object_id:<12} {str(d.in_progress):<14} {d.date_scheduled}"
        )


@deletions.command("run")
@click.option(
    "-i", "--id", "deletion_id", type=int, help="Specific deletion ID to run", default=None
)
@click.option(
    "-m",
    "--model",
    help="Run all pending deletions for a model name (e.g. OrganizationIntegration)",
    default=None,
)
@click.option("--all", "run_all", is_flag=True, help="Run all pending deletions")
@configuration
def run_deletions(deletion_id: int | None, model: str | None, run_all: bool) -> None:
    """
    Run pending scheduled deletions synchronously.
    """
    from sentry.deletions.models.scheduleddeletion import ScheduledDeletion

    if not any([deletion_id, model, run_all]):
        raise click.UsageError(
            "Provide one of: --id, --model, or --all. "
            "Use `sentry deletions list` to see pending deletions."
        )

    if deletion_id:
        try:
            deletion = ScheduledDeletion.objects.get(id=deletion_id)
        except ScheduledDeletion.DoesNotExist:
            click.echo(f"Deletion with ID {deletion_id} not found.")
            return
        _run_one(deletion)
        return

    queryset = ScheduledDeletion.objects.all()
    if model:
        queryset = queryset.filter(model_name=model)

    deletions_list = list(queryset)
    if not deletions_list:
        click.echo("No pending deletions found.")
        return

    click.echo(f"Running {len(deletions_list)} deletion(s)...")
    for d in deletions_list:
        _run_one(d)


def _run_one(deletion) -> None:  # type: ignore[no-untyped-def]
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
        click.echo(f"  Failed: {e}")
