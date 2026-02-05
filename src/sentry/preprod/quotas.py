from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

import sentry_sdk
from django.contrib.auth.models import AnonymousUser

from sentry import features, quotas
from sentry.constants import DataCategory
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.preprod.api.endpoints.builds import artifact_matches_query
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.producer import PreprodFeature
from sentry.users.models.user import User

logger = logging.getLogger(__name__)

SIZE_ENABLED_KEY = "sentry:preprod_size_enabled_by_customer"
SIZE_ENABLED_QUERY_KEY = "sentry:preprod_size_enabled_query"
DISTRIBUTION_ENABLED_KEY = "sentry:preprod_distribution_enabled_by_customer"
DISTRIBUTION_ENABLED_QUERY_KEY = "sentry:preprod_distribution_enabled_query"


def has_size_quota(organization: Organization, actor: User | AnonymousUser | None = None) -> bool:
    if not features.has("organizations:preprod-enforce-size-quota", organization, actor=actor):
        logger.info(
            "has_size_quota",
            extra={"organization_id": organization.id, "result": True, "reason": "not_enforced"},
        )
        return True
    result = quotas.backend.has_usage_quota(organization.id, DataCategory.SIZE_ANALYSIS)
    logger.info(
        "has_size_quota",
        extra={"organization_id": organization.id, "result": result, "reason": "quota_check"},
    )
    return result


def has_installable_quota(
    organization: Organization, actor: User | AnonymousUser | None = None
) -> bool:
    if not features.has(
        "organizations:preprod-enforce-distribution-quota", organization, actor=actor
    ):
        logger.info(
            "has_installable_quota",
            extra={"organization_id": organization.id, "result": True, "reason": "not_enforced"},
        )
        return True
    result = quotas.backend.has_usage_quota(organization.id, DataCategory.INSTALLABLE_BUILD)
    logger.info(
        "has_installable_quota",
        extra={"organization_id": organization.id, "result": result, "reason": "quota_check"},
    )
    return result


SkipReason = str | None


def should_run_feature(
    artifact: PreprodArtifact,
    *,
    query_key: str,
    quota_check: Callable[[], bool],
    feature: str | PreprodFeature,
    enabled_key: str,
) -> tuple[bool, SkipReason]:
    """
    Check if a feature should run for an artifact based on enabled flag, quota and query filter.

    Args:
        artifact: The PreprodArtifact to check
        query_key: The project option key for the query filter
        quota_check: A callable that returns True if the organization has quota
        feature: Name of the feature for logging purposes
        enabled_key: The project option key for the feature enabled flag

    Returns:
        A tuple of (should_run, skip_reason) where skip_reason is None if should_run
        is True, 'disabled' if feature is disabled, 'quota' if quota is exceeded, or
        'filtered' if filtered out by query.
    """
    assert enabled_key is not None
    assert query_key is not None

    project = artifact.project
    organization = project.organization

    enabled = project.get_option(enabled_key, default=True)
    if not enabled:
        logger.info(
            "Feature disabled for project",
            extra={
                "preprod_artifact_id": artifact.id,
                "project_id": project.id,
                "organization_id": organization.id,
                "feature": feature,
            },
        )
        return False, "disabled"

    if not quota_check():
        logger.info(
            "No quota for feature",
            extra={
                "preprod_artifact_id": artifact.id,
                "project_id": project.id,
                "organization_id": organization.id,
                "feature": feature,
            },
        )
        return False, "quota"

    query = project.get_option(query_key, default="")

    if not query:
        logger.info(
            "Empty feature filter",
            extra={
                "preprod_artifact_id": artifact.id,
                "project_id": project.id,
                "organization_id": organization.id,
                "feature": feature,
            },
        )
        return True, None

    try:
        result = artifact_matches_query(artifact, query, organization)
    except InvalidSearchQuery as e:
        logger.info(
            "Feature filter invalid",
            extra={
                "preprod_artifact_id": artifact.id,
                "project_id": project.id,
                "organization_id": organization.id,
                "query": query,
                "feature": feature,
            },
        )
        sentry_sdk.capture_exception(e)
        return True, None
    else:
        logger.info(
            "Artifact %s feature filter",
            "matches" if result else "does not match",
            extra={
                "preprod_artifact_id": artifact.id,
                "project_id": project.id,
                "organization_id": organization.id,
                "query": query,
                "feature": feature,
            },
        )
        return result, None if result else "filtered"


def should_run_size(artifact: PreprodArtifact, actor: Any = None) -> tuple[bool, SkipReason]:
    organization = artifact.project.organization
    return should_run_feature(
        artifact,
        query_key=SIZE_ENABLED_QUERY_KEY,
        quota_check=lambda: has_size_quota(organization, actor=actor),
        feature=PreprodFeature.SIZE_ANALYSIS,
        enabled_key=SIZE_ENABLED_KEY,
    )


def should_run_distribution(
    artifact: PreprodArtifact, actor: Any = None
) -> tuple[bool, SkipReason]:
    organization = artifact.project.organization
    return should_run_feature(
        artifact,
        query_key=DISTRIBUTION_ENABLED_QUERY_KEY,
        quota_check=lambda: has_installable_quota(organization, actor=actor),
        feature=PreprodFeature.BUILD_DISTRIBUTION,
        enabled_key=DISTRIBUTION_ENABLED_KEY,
    )
