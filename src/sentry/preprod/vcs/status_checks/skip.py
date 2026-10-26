from __future__ import annotations

import logging
from datetime import datetime
from typing import Literal, Never

from django.utils import timezone

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.project import Project
from sentry.preprod.vcs.status_checks.size.templates import format_all_skipped_messages
from sentry.preprod.vcs.status_checks.snapshots.templates import (
    format_skipped_snapshot_status_check_messages,
)
from sentry.preprod.vcs.status_checks.utils import (
    get_status_check_client_for_repo,
    get_status_check_provider,
)
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiRateLimitedError,
    IntegrationError,
)

logger = logging.getLogger(__name__)

StatusCheckType = Literal["size", "snapshots"]

# Check types that support being marked as skipped via the API.
SUPPORTED_SKIP_CHECK_TYPES: tuple[StatusCheckType, ...] = ("size", "snapshots")
SUPPORTED_STATUS_CHECK_PROVIDERS = (
    IntegrationProviderSlug.GITHUB,
    IntegrationProviderSlug.GITHUB_ENTERPRISE,
)
CONFIGURATION_ERROR_DETAIL = (
    "Could not create the status check. Verify that the repository integration is installed "
    "and has permission to create checks."
)


class SkipStatusCheckError(Exception):
    """An expected failure while posting a skipped status check, carrying the
    HTTP status, detail, and reason the endpoint returns.
    """

    def __init__(self, detail: str, status_code: int, reason: str) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code
        self.reason = reason


def _skipped_check_messages(check_type: StatusCheckType, project: Project) -> tuple[str, str, str]:
    if check_type == "size":
        return format_all_skipped_messages(project)
    return format_skipped_snapshot_status_check_messages(project)


def _raise_configuration_error(
    error: IntegrationError, *, project: Project, check_type: StatusCheckType, provider: str
) -> Never:
    logger.warning(
        "preprod.status_checks.skip.configuration_error",
        extra={
            "project_id": project.id,
            "organization_id": project.organization_id,
            "check_type": check_type,
            "provider": provider,
            "error_type": type(error).__name__,
        },
        exc_info=True,
    )
    raise SkipStatusCheckError(
        CONFIGURATION_ERROR_DETAIL,
        status_code=400,
        reason="config_error",
    ) from error


def create_skipped_status_check(
    *, project: Project, repo_name: str, provider: str, sha: str, check_type: StatusCheckType
) -> str:
    """Post a passing "skipped" status check for a bare commit SHA.

    This lets a customer keep the size/snapshot check as a *required* GitHub check
    while intentionally not uploading an artifact for some PRs: we post a check with
    the same name Sentry uses during normal processing (so branch protection is
    satisfied) but with a neutral "skipped" result.

    Returns the created check id. Raises SkipStatusCheckError for expected failures.
    """
    if check_type not in SUPPORTED_SKIP_CHECK_TYPES:
        raise SkipStatusCheckError(
            f"Unsupported check type '{check_type}'. "
            f"Supported: {', '.join(SUPPORTED_SKIP_CHECK_TYPES)}.",
            status_code=400,
            reason="unsupported_check_type",
        )
    if provider not in SUPPORTED_STATUS_CHECK_PROVIDERS:
        raise SkipStatusCheckError(
            f"Unsupported provider '{provider}'. Supported providers: "
            f"{', '.join(SUPPORTED_STATUS_CHECK_PROVIDERS)}.",
            status_code=400,
            reason="unsupported_provider",
        )

    try:
        client, repository = get_status_check_client_for_repo(project, repo_name, provider)
    except IntegrationError as e:
        _raise_configuration_error(e, project=project, check_type=check_type, provider=provider)

    if not client or not repository:
        raise SkipStatusCheckError(
            f"No active {provider} integration found for repository '{repo_name}'.",
            status_code=400,
            reason="repo_not_integrated",
        )

    status_check_provider = get_status_check_provider(
        client,
        provider,
        project.organization_id,
        project.organization.slug,
        repository.integration_id,
    )
    if not status_check_provider:
        raise SkipStatusCheckError(
            f"Status checks are not supported for provider '{provider}'.",
            status_code=400,
            reason="provider_unsupported",
        )

    title, subtitle, summary = _skipped_check_messages(check_type, project)

    # NEUTRAL is non-blocking for a required check; completed_at must be set or
    # GitHub rejects a completed check.
    now: datetime = timezone.now()
    try:
        check_id = status_check_provider.create_status_check(
            repo=repo_name,
            sha=sha,
            status=StatusCheckStatus.NEUTRAL,
            title=title,
            subtitle=subtitle,
            text=None,
            summary=summary,
            external_id=f"{check_type}-skip-{sha}",
            started_at=now,
            completed_at=now,
        )
    except IntegrationError as e:
        _raise_configuration_error(e, project=project, check_type=check_type, provider=provider)
    except ApiRateLimitedError as e:
        raise SkipStatusCheckError(
            "GitHub rate limit exceeded, please retry later.",
            status_code=429,
            reason="rate_limited",
        ) from e
    except ApiError as e:
        logger.warning(
            "preprod.status_checks.skip.api_error",
            extra={
                "project_id": project.id,
                "organization_id": project.organization_id,
                "check_type": check_type,
                "repository_id": repository.id,
                "status_code": e.code,
            },
        )
        raise SkipStatusCheckError(
            "Failed to post status check to GitHub.",
            status_code=502,
            reason="upstream_error",
        ) from e

    if check_id is None:
        logger.warning(
            "preprod.status_checks.skip.null_check_id",
            extra={
                "project_id": project.id,
                "organization_id": project.organization_id,
                "check_type": check_type,
                "repository_id": repository.id,
                "provider": provider,
            },
        )
        raise SkipStatusCheckError(
            "Failed to post status check to GitHub.",
            status_code=502,
            reason="null_check_id",
        )

    logger.info(
        "preprod.status_checks.skip.success",
        extra={
            "project_id": project.id,
            "organization_id": project.organization_id,
            "check_type": check_type,
            "repository_id": repository.id,
            "sha": sha,
            "check_id": check_id,
        },
    )
    return check_id
