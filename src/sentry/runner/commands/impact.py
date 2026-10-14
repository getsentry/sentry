from __future__ import annotations

import click

from sentry.runner.decorators import configuration


@click.group()
def impact() -> None:
    """Issue Impact development utilities."""


@impact.command("assess")
@click.argument("group_id", type=int)
@configuration
def assess(group_id: int) -> None:
    """Assess the given group and record its current Impact."""

    from sentry.issues.impact.assessment import assess_impact_for_group
    from sentry.models.group import Group

    try:
        group = Group.objects.select_related("project__organization").get(id=group_id)
    except Group.DoesNotExist as error:
        raise click.ClickException(f"Group {group_id} does not exist") from error

    try:
        result = assess_impact_for_group(group=group)
    except Exception as error:
        raise click.ClickException(
            f"Impact assessment failed after recording the attempt: {type(error).__name__}: {error}"
        ) from error

    click.echo(
        f"Queued Seer Impact assessment {result.uuid} for group {group.id}. "
        "Open the issue in Sentry to see the results."
    )
