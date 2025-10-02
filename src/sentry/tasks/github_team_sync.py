"""
Task for synchronizing GitHub team names with stored ExternalActor mappings.

This task periodically fetches team information from GitHub and updates the
external_name field in ExternalActor records when teams are renamed.
"""
import logging
from collections.abc import Mapping, Sequence
from typing import Any

from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.types import ExternalProviders
from sentry.models.organization import Organization
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.github_team_sync.schedule_github_team_sync",
    queue="integrations.github_team_sync",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=integrations_tasks,
        retry=Retry(times=3, delay=60),
        processing_deadline_duration=30 * 60,  # 30 minutes
    ),
)
def schedule_github_team_sync() -> None:
    """
    Schedule GitHub team sync for all organizations with GitHub integrations.

    This task is triggered periodically (e.g., daily) and spawns individual
    sync tasks for each organization with GitHub integrations.
    """
    logger.info("github_team_sync.schedule_start")

    # Find all organizations with GitHub integrations that have team mappings
    github_providers = [
        ExternalProviders.GITHUB.value,
        ExternalProviders.GITHUB_ENTERPRISE.value,
    ]

    organizations_with_teams = (
        ExternalActor.objects.filter(
            provider__in=github_providers,
            team__isnull=False,
        )
        .values_list("organization_id", flat=True)
        .distinct()
    )

    scheduled_count = 0
    for organization_id in organizations_with_teams:
        sync_github_teams_for_organization.delay(organization_id)
        scheduled_count += 1

    logger.info(
        "github_team_sync.schedule_complete",
        extra={"scheduled_organizations": scheduled_count}
    )
    metrics.incr("github_team_sync.organizations_scheduled", amount=scheduled_count)


@instrumented_task(
    name="sentry.tasks.github_team_sync.sync_github_teams_for_organization",
    queue="integrations.github_team_sync",
    max_retries=5,
    default_retry_delay=300,  # 5 minutes
    acks_late=True,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=integrations_tasks,
        retry=Retry(times=5, delay=300),
        processing_deadline_duration=15 * 60,  # 15 minutes
    ),
)
def sync_github_teams_for_organization(organization_id: int) -> None:
    """
    Synchronize GitHub team names for a specific organization.

    Args:
        organization_id: ID of the organization to sync teams for
    """
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.error(
            "github_team_sync.organization_not_found",
            extra={"organization_id": organization_id}
        )
        return

    logger.info(
        "github_team_sync.sync_start",
        extra={
            "organization_id": organization_id,
            "organization_slug": organization.slug,
        }
    )

    # Get all GitHub integrations for this organization
    github_integrations = integration_service.get_integrations(
        organization_id=organization_id,
        providers=["github", "github_enterprise"],
        status=1,  # ACTIVE
    )

    if not github_integrations:
        logger.info(
            "github_team_sync.no_integrations",
            extra={"organization_id": organization_id}
        )
        return

    total_synced = 0
    total_updated = 0
    total_errors = 0

    for integration in github_integrations:
        try:
            synced, updated = _sync_teams_for_integration(organization, integration)
            total_synced += synced
            total_updated += updated
        except Exception as e:
            logger.exception(
                "github_team_sync.integration_sync_error",
                extra={
                    "organization_id": organization_id,
                    "integration_id": integration.id,
                    "error": str(e),
                }
            )
            total_errors += 1

    logger.info(
        "github_team_sync.sync_complete",
        extra={
            "organization_id": organization_id,
            "organization_slug": organization.slug,
            "teams_synced": total_synced,
            "teams_updated": total_updated,
            "integration_errors": total_errors,
        }
    )

    metrics.incr("github_team_sync.teams_synced", amount=total_synced)
    metrics.incr("github_team_sync.teams_updated", amount=total_updated)
    metrics.incr("github_team_sync.integration_errors", amount=total_errors)


def _sync_teams_for_integration(organization: Organization, integration) -> tuple[int, int]:
    """
    Sync teams for a specific GitHub integration.

    Args:
        organization: The organization
        integration: The GitHub integration

    Returns:
        Tuple of (teams_synced, teams_updated)
    """
    from sentry.integrations.github.integration import GitHubIntegration

    # Get the integration installation
    try:
        install = integration.get_installation(organization_id=organization.id)
        if not isinstance(install, GitHubIntegration):
            logger.error(
                "github_team_sync.invalid_integration_type",
                extra={
                    "organization_id": organization.id,
                    "integration_id": integration.id,
                    "integration_type": type(install).__name__,
                }
            )
            return 0, 0

        client = install.get_client()

    except Exception as e:
        logger.exception(
            "github_team_sync.client_error",
            extra={
                "organization_id": organization.id,
                "integration_id": integration.id,
                "error": str(e),
            }
        )
        return 0, 0

    # Get stored team mappings for this integration
    provider = (
        ExternalProviders.GITHUB.value
        if integration.provider == "github"
        else ExternalProviders.GITHUB_ENTERPRISE.value
    )

    stored_teams = ExternalActor.objects.filter(
        organization=organization,
        integration_id=integration.id,
        provider=provider,
        team__isnull=False,
    )

    if not stored_teams.exists():
        logger.info(
            "github_team_sync.no_stored_teams",
            extra={
                "organization_id": organization.id,
                "integration_id": integration.id,
            }
        )
        return 0, 0

    # Fetch current teams from GitHub
    try:
        github_teams = _fetch_github_teams(client, integration)
    except Exception as e:
        logger.exception(
            "github_team_sync.fetch_teams_error",
            extra={
                "organization_id": organization.id,
                "integration_id": integration.id,
                "error": str(e),
            }
        )
        raise

    # Create lookup map of GitHub teams by external_id
    github_teams_by_id = {str(team["id"]): team for team in github_teams}

    teams_synced = 0
    teams_updated = 0

    # Check each stored team mapping for name changes
    for stored_team in stored_teams:
        if not stored_team.external_id:
            # Skip teams without external_id (shouldn't happen but be safe)
            continue

        github_team = github_teams_by_id.get(stored_team.external_id)
        if not github_team:
            logger.warning(
                "github_team_sync.team_not_found_on_github",
                extra={
                    "organization_id": organization.id,
                    "integration_id": integration.id,
                    "external_id": stored_team.external_id,
                    "stored_name": stored_team.external_name,
                }
            )
            teams_synced += 1
            continue

        # Check if the team name has changed
        github_name = f"@{github_team['name']}"  # External names start with @
        if stored_team.external_name != github_name:
            logger.info(
                "github_team_sync.team_name_changed",
                extra={
                    "organization_id": organization.id,
                    "integration_id": integration.id,
                    "external_id": stored_team.external_id,
                    "old_name": stored_team.external_name,
                    "new_name": github_name,
                }
            )

            # Update the stored team name
            stored_team.external_name = github_name
            stored_team.save(update_fields=["external_name", "date_updated"])
            teams_updated += 1

        teams_synced += 1

    return teams_synced, teams_updated


def _fetch_github_teams(client, integration) -> Sequence[Mapping[str, Any]]:
    """
    Fetch all teams from GitHub for the integration.

    Args:
        client: GitHub API client
        integration: The GitHub integration

    Returns:
        List of team data from GitHub API
    """
    try:
        # Get the organization name from integration metadata
        org_name = integration.metadata.get("account", {}).get("login")
        if not org_name:
            raise ValueError("No organization name found in integration metadata")

        teams = client.get_organization_teams(org_name)
        return teams

    except Exception as e:
        logger.exception(
            "github_team_sync.api_error",
            extra={
                "integration_id": integration.id,
                "error": str(e),
            }
        )
        raise
