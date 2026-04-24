"""
Shared contributor-seat helpers used by provider webhooks (GitHub, GitLab, etc.).

This module is kept free of provider-specific imports so any SCM integration
can reuse it without pulling in GitHub/GitLab internals.
"""

from __future__ import annotations

import logging

import sentry_sdk
from django.db import router, transaction
from orjson import JSONDecodeError
from pydantic import ValidationError
from urllib3.exceptions import HTTPError

from sentry import features, quotas
from sentry.constants import DataCategory, ObjectStatus
from sentry.models.organization import Organization
from sentry.models.organizationcontributors import (
    ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD,
    OrganizationContributors,
)
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.models.repositorysettings import RepositorySettings
from sentry.seer.autofix.utils import bulk_get_project_preferences, resolve_repository_ids
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.seer.models.seer_api_models import SeerApiError, SeerProjectPreference
from sentry.tasks.organization_contributors import assign_seat_to_organization_contributor

logger = logging.getLogger(__name__)


def _is_code_review_enabled_for_repo(repository_id: int) -> bool:
    """Check if code review is explicitly enabled for this repository."""
    return RepositorySettings.objects.filter(
        repository_id=repository_id,
        enabled_code_review=True,
    ).exists()


def _is_autofix_enabled_for_repo(organization: Organization, repository_id: int) -> bool:
    """
    Check if autofix is enabled for any active project associated with
    this repository, ie, if any project has this repository configured
    in Seer preferences.
    """
    if features.has("organizations:seer-project-settings-read-from-sentry", organization):
        return SeerProjectRepository.objects.filter(
            repository_id=repository_id,
            project__organization_id=organization.id,
            project__status=ObjectStatus.ACTIVE,
        ).exists()

    project_ids = list(
        Project.objects.filter(
            organization_id=organization.id,
            status=ObjectStatus.ACTIVE,
        ).values_list("id", flat=True)
    )

    if not project_ids:
        return False

    try:
        raw_preferences = bulk_get_project_preferences(organization.id, project_ids)
        validated_preferences = [
            SeerProjectPreference.validate(pref) for pref in raw_preferences.values() if pref
        ]
        resolved_preferences = resolve_repository_ids(organization.id, validated_preferences)
    except (SeerApiError, HTTPError):
        logger.warning(
            "seer.contributor_seats.autofix_check_error",
            extra={"organization_id": organization.id, "repository_id": repository_id},
        )
        return False
    except (JSONDecodeError, ValidationError, Exception):
        sentry_sdk.capture_exception()
        return False

    return any(
        repo.repository_id == repository_id
        for pref in resolved_preferences
        for repo in pref.repositories
    )


def _has_code_review_or_autofix_enabled(organization: Organization, repository_id: int) -> bool:
    """
    Check if either code review is enabled for the repo OR autofix automation
    is enabled for any linked project.
    """
    return _is_code_review_enabled_for_repo(repository_id) or _is_autofix_enabled_for_repo(
        organization, repository_id
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
        or contributor.is_bot
        or not _has_code_review_or_autofix_enabled(organization, repo.id)
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

    logger.info(
        "scm.webhook.organization_contributor.should_create",
        extra={"provider": provider},
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
