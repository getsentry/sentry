"""
Shared contributor-seat helpers used by provider webhooks (GitHub, GitLab, etc.).

This module is kept free of provider-specific imports so any SCM integration
can reuse it without pulling in GitHub/GitLab internals.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from django.db import IntegrityError, router, transaction
from django.db.models import F

from sentry import features, quotas
from sentry.constants import DataCategory, ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.utils.hostname import InstanceHostnameError, instance_hostname
from sentry.models.organization import Organization
from sentry.models.organizationcontributors import (
    ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD,
    OrganizationContributorAction,
    OrganizationContributors,
)
from sentry.models.repository import Repository
from sentry.models.repositorysettings import RepositorySettings
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.tasks.organization_contributors import assign_seat_to_organization_contributor
from sentry.utils import metrics

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
    return SeerProjectRepository.objects.filter(
        project_repository__repository_id=repository_id,
        project_repository__project__organization_id=organization.id,
        project_repository__project__status=ObjectStatus.ACTIVE,
        project_repository__repository__status=ObjectStatus.ACTIVE,
    ).exists()


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


def get_canonical_contributor(
    *,
    organization_id: int,
    integration: Integration | RpcIntegration,
    external_identifier: str,
) -> OrganizationContributors | None:
    """
    TODO(CW-1539): Replace with get() after the contributor deduplication
    migration has completed.
    """
    try:
        hostname = instance_hostname(integration)
    except InstanceHostnameError as e:
        sentry_sdk.capture_exception(e)
        return None

    # Prefer the current billing period's seat holder (contributor with the most
    # actions), with id as a stable tiebreaker.
    return (
        OrganizationContributors.objects.filter(
            organization_id=organization_id,
            provider=integration.provider,
            hostname=hostname,
            external_identifier=external_identifier,
        )
        .order_by("-num_actions", "id")
        .first()
    )


def get_or_create_contributor(
    *,
    organization: Organization,
    integration: Integration | RpcIntegration,
    external_identifier: str,
    alias: str | None,
) -> OrganizationContributors | None:
    """
    TODO(CW-1539): Replace with get_or_create() after the contributor deduplication
    migration has completed.
    """
    try:
        hostname = instance_hostname(integration)
    except InstanceHostnameError as e:
        sentry_sdk.capture_exception(e)
        return None

    if contributor := get_canonical_contributor(
        organization_id=organization.id,
        integration=integration,
        external_identifier=external_identifier,
    ):
        return contributor

    try:
        with transaction.atomic(router.db_for_write(OrganizationContributors)):
            return OrganizationContributors.objects.create(
                organization_id=organization.id,
                integration_id=integration.id,
                external_identifier=external_identifier,
                provider=integration.provider,
                hostname=hostname,
                alias=alias,
            )
    except IntegrityError:
        contributor = get_canonical_contributor(
            organization_id=organization.id,
            integration=integration,
            external_identifier=external_identifier,
        )
        if not contributor:
            raise
        return contributor


def track_contributor_seat(
    *,
    organization: Organization,
    repo: Repository,
    integration: Integration | RpcIntegration,
    user_id: str | int,
    user_username: str,
    logs_extra: Mapping[str, Any] | None = None,
) -> None:
    """Informational logging for the legacy seat-charging path."""
    contributor = get_or_create_contributor(
        organization=organization,
        integration=integration,
        external_identifier=str(user_id),
        alias=user_username,
    )
    if not contributor or not should_increment_contributor_seat(organization, repo, contributor):
        return

    logger.info(
        "scm.webhook.organization_contributor.num_actions_should_increment",
        extra={
            "provider": integration.provider,
            "organization_id": organization.id,
            "integration_id": integration.id,
            "pr_author_id": str(user_id),
            "pr_author_login": user_username,
            "contributor_id": contributor.id,
            **(logs_extra or {}),
        },
    )
    metrics.incr(
        "scm.webhook.organization_contributor.num_actions_should_increment",
        sample_rate=1.0,
        tags={"provider": integration.provider},
    )


def record_contributor_action(
    *,
    organization: Organization,
    repo: Repository,
    integration: Integration | RpcIntegration,
    user_id: str | int,
    user_username: str | None,
    pr_number: str | int,
    is_opened: bool,
    logs_extra: Mapping[str, Any] | None = None,
    tags: Mapping[str, Any] | None = None,
) -> None:
    """Seed a contributor and record the contributor's PR-opened action."""
    contributor = get_or_create_contributor(
        organization=organization,
        integration=integration,
        external_identifier=str(user_id),
        alias=user_username,
    )

    if (
        not contributor
        or not is_opened
        or not should_increment_contributor_seat(organization, repo, contributor)
    ):
        return

    with transaction.atomic(router.db_for_write(OrganizationContributors)):
        _, created = OrganizationContributorAction.objects.get_or_create(
            repository_id=repo.id,
            pr_number=str(pr_number),
            defaults={"organization_contributor": contributor},
        )
        if not created:
            return

        OrganizationContributors.objects.filter(id=contributor.id).update(
            num_actions=F("num_actions") + 1
        )

    logger.info(
        "scm.webhook.organization_contributor.action_recorded",
        extra={
            "provider": integration.provider,
            "organization_id": organization.id,
            "integration_id": integration.id,
            "pr_author_id": str(user_id),
            "pr_author_login": user_username,
            "contributor_id": contributor.id,
            "pr_number": str(pr_number),
            **(logs_extra or {}),
            **(tags or {}),
        },
    )
    metrics.incr(
        "scm.webhook.organization_contributor.action_recorded",
        sample_rate=1.0,
        tags={"provider": integration.provider, **(tags or {})},
    )

    contributor.refresh_from_db(fields=["num_actions"])
    if contributor.num_actions >= ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD:
        assign_seat_to_organization_contributor.delay(contributor.id)
