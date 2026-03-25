"""
Shared contributor-seat helpers used by provider webhooks (GitHub, GitLab, etc.).

This module is kept free of provider-specific imports so any SCM integration
can reuse it without pulling in GitHub/GitLab internals.
"""

from __future__ import annotations

import logging

from django.db import router, transaction

from sentry import features, quotas
from sentry.constants import DataCategory, ObjectStatus
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.organizationcontributors import (
    ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD,
    OrganizationContributors,
)
from sentry.models.repository import Repository
from sentry.models.repositorysettings import RepositorySettings
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.tasks.organization_contributors import assign_seat_to_organization_contributor
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def _is_code_review_enabled_for_repo(repository_id: int) -> bool:
    """Check if code review is explicitly enabled for this repository."""
    return RepositorySettings.objects.filter(
        repository_id=repository_id,
        enabled_code_review=True,
    ).exists()


def _is_autofix_enabled_for_repo(organization_id: int, repository_id: int) -> bool:
    """
    Check if autofix automation is enabled (not "off") for any project
    associated with this repository via code mappings.
    """
    repo_configs = RepositoryProjectPathConfig.objects.filter(
        repository_id=repository_id,
        organization_id=organization_id,
    ).values_list("project_id", flat=True)

    if not repo_configs:
        return False

    return (
        ProjectOption.objects.filter(
            project_id__in=repo_configs,
            project__status=ObjectStatus.ACTIVE,
            key="sentry:autofix_automation_tuning",
        )
        .exclude(value=AutofixAutomationTuningSettings.OFF.value)
        .exclude(value__isnull=True)
        .exists()
    )


def _has_code_review_or_autofix_enabled(organization_id: int, repository_id: int) -> bool:
    """
    Check if either code review is enabled for the repo OR autofix automation
    is enabled for any linked project.
    """
    return _is_code_review_enabled_for_repo(repository_id) or _is_autofix_enabled_for_repo(
        organization_id, repository_id
    )


def should_increment_contributor_seat(
    organization: Organization, repo: Repository, contributor: OrganizationContributors
) -> bool:
    """
    Determines if we should increment an OrganizationContributor record
    and potentially assign a new seat.

    Require repo integration, code review OR autofix enabled for the repo,
    seat-based Seer enabled for the organization, and contributor is not a bot.
    """
    if (
        repo.integration_id is None
        or not _has_code_review_or_autofix_enabled(organization.id, repo.id)
        or contributor.is_bot
        or not features.has("organizations:seat-based-seer-enabled", organization)
    ):
        return False

    return quotas.backend.check_seer_quota(
        org_id=organization.id,
        data_category=DataCategory.SEER_USER,
        seat_object=contributor,
    )


def track_contributor_seat(
    *,
    organization: Organization,
    repo: Repository,
    integration_id: int,
    user_id: str | int,
    user_username: str,
    provider: str,
) -> None:
    """
    Track a contributor for seat billing. Creates or retrieves the contributor
    record, checks eligibility, atomically increments the action count, and
    queues seat assignment when the activation threshold is reached.
    """
    contributor, _ = OrganizationContributors.objects.get_or_create(
        organization_id=organization.id,
        integration_id=integration_id,
        external_identifier=str(user_id),
        defaults={"alias": user_username},
    )

    if not should_increment_contributor_seat(organization, repo, contributor):
        return

    metrics.incr(
        "scm.webhook.organization_contributor.should_create",
        sample_rate=1.0,
        tags={"provider": provider},
    )

    locked_contributor = None
    with transaction.atomic(router.db_for_write(OrganizationContributors)):
        try:
            locked_contributor = OrganizationContributors.objects.select_for_update().get(
                id=contributor.id,
            )
            locked_contributor.num_actions += 1
            locked_contributor.save(update_fields=["num_actions", "date_updated"])
        except OrganizationContributors.DoesNotExist:
            logger.warning(
                "scm.webhook.organization_contributor.not_found",
                extra={
                    "provider": provider,
                    "organization_id": organization.id,
                    "integration_id": integration_id,
                    "external_identifier": str(user_id),
                },
            )

    if (
        locked_contributor
        and locked_contributor.num_actions >= ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD
    ):
        assign_seat_to_organization_contributor.delay(locked_contributor.id)
