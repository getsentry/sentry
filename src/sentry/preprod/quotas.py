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

SIZE_ENABLED_QUERY_KEY = "sentry:preprod_size_enabled_query"
DISTRIBUTION_ENABLED_QUERY_KEY = "sentry:preprod_distribution_enabled_query"


def has_size_quota(organization: Organization, actor: User | AnonymousUser | None = None) -> bool:
    if not features.has("organizations:preprod-enforce-quota", organization, actor=actor):
        return True
    return quotas.backend.has_usage_quota(organization.id, DataCategory.SIZE_ANALYSIS)


def has_installable_quota(
    organization: Organization, actor: User | AnonymousUser | None = None
) -> bool:
    if not features.has("organizations:preprod-enforce-quota", organization, actor=actor):
        return True
    return quotas.backend.has_usage_quota(organization.id, DataCategory.INSTALLABLE_BUILD)


def should_run_feature(
    artifact: PreprodArtifact,
    query_key: str,
    quota_check: Callable[[], bool],
    feature: str | PreprodFeature,
) -> bool:
    """
    Check if a feature should run for an artifact based on quota and query filter.

    Args:
        artifact: The PreprodArtifact to check
        query_key: The project option key for the query filter
        quota_check: A callable that returns True if the organization has quota
        feature: Name of the feature for logging purposes

    Returns:
        True if the feature should run, False otherwise
    """
    project = artifact.project
    organization = project.organization

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
        return False

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
        return True

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
        return True
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
        return result


def should_run_size(artifact: PreprodArtifact, actor: Any = None) -> bool:
    organization = artifact.project.organization
    return should_run_feature(
        artifact,
        SIZE_ENABLED_QUERY_KEY,
        lambda: has_size_quota(organization, actor=actor),
        PreprodFeature.SIZE_ANALYSIS,
    )


def should_run_distribution(artifact: PreprodArtifact, actor: Any = None) -> bool:
    organization = artifact.project.organization
    return should_run_feature(
        artifact,
        DISTRIBUTION_ENABLED_QUERY_KEY,
        lambda: has_installable_quota(organization, actor=actor),
        PreprodFeature.BUILD_DISTRIBUTION,
    )
