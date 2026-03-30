from __future__ import annotations

from typing import TYPE_CHECKING

import click

if TYPE_CHECKING:
    from sentry.models.organization import Organization
from sentry.runner.decorators import configuration


def _resolve_organization(org_value: str) -> Organization:
    from sentry.models.organization import Organization

    try:
        if org_value.isdigit():
            return Organization.objects.get(id=int(org_value))
        return Organization.objects.get(slug=org_value)
    except Organization.DoesNotExist:
        raise click.ClickException(f"Organization not found: {org_value}")


@click.command()
@click.option("--name", required=True, help="The name of the project.")
@click.option(
    "--platform",
    help="The platform for the project (e.g., 'python', 'javascript-react').",
)
@click.option("--organization", "org", required=True, help="Organization ID or slug.")
@click.option("--team", default=None, help="Team slug to grant access to the project.")
@configuration
def createproject(
    name: str,
    platform: str,
    org: str,
    team: str | None,
) -> None:
    """Create a new project."""
    from django.contrib.auth.models import AnonymousUser
    from django.db import router, transaction

    from sentry.api.helpers.default_symbol_sources import set_default_symbol_sources
    from sentry.core.endpoints.team_projects import apply_default_project_settings
    from sentry.models.project import Project
    from sentry.models.projectkey import ProjectKey
    from sentry.models.team import Team, TeamStatus
    from sentry.signals import project_created

    organization = _resolve_organization(org)

    team_instance = None
    if team:
        try:
            team_instance = Team.objects.get(
                organization=organization,
                slug=team,
                status=TeamStatus.ACTIVE,
            )
        except Team.DoesNotExist:
            raise click.ClickException(
                f"Team not found: '{team}' in organization '{organization.slug}'"
            )

    with transaction.atomic(router.db_for_write(Project)):
        project = Project.objects.create(
            name=name,
            organization=organization,
            platform=platform,
        )

        if team_instance:
            project.add_team(team_instance)

        set_default_symbol_sources(project)
        apply_default_project_settings(organization, project)

        project_created.send_robust(
            project=project,
            default_rules=True,
            user=AnonymousUser(),
            sender=createproject,
        )

    key = ProjectKey.get_default(project)
    dsn = key.dsn_public if key else "(no DSN available)"

    click.echo("Created project:")
    click.echo(f"  ID: {project.id}")
    click.echo(f"  Slug: {project.slug}")
    click.echo(f"  DSN: {dsn}")
