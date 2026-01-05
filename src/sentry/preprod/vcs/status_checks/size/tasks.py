from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import datetime
from enum import StrEnum
from typing import Any

from django.db import router, transaction

from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.github.status_check import GitHubCheckConclusion, GitHubCheckStatus
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.source_code_management.status_check import (
    StatusCheckClient,
    StatusCheckStatus,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.commitcomparison import CommitComparison
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.url_utils import get_preprod_artifact_url
from sentry.preprod.vcs.status_checks.size.templates import format_status_check_messages
from sentry.shared_integrations.exceptions import ApiError, IntegrationConfigurationError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks
from sentry.taskworker.retry import Retry

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.preprod.tasks.create_preprod_status_check",
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    retry=Retry(times=3, ignore=(IntegrationConfigurationError,)),
    silo_mode=SiloMode.REGION,
)
def create_preprod_status_check_task(preprod_artifact_id: int, **kwargs: Any) -> None:
    try:
        preprod_artifact: PreprodArtifact | None = PreprodArtifact.objects.get(
            id=preprod_artifact_id
        )
    except PreprodArtifact.DoesNotExist:
        logger.exception(
            "preprod.status_checks.create.artifact_not_found",
            extra={"artifact_id": preprod_artifact_id},
        )
        return

    if not preprod_artifact or not isinstance(preprod_artifact, PreprodArtifact):
        logger.error(
            "preprod.status_checks.create.artifact_not_found",
            extra={"artifact_id": preprod_artifact_id},
        )
        return

    logger.info(
        "preprod.status_checks.create.start",
        extra={"artifact_id": preprod_artifact.id},
    )

    if not preprod_artifact.commit_comparison:
        logger.info(
            "preprod.status_checks.create.no_commit_comparison",
            extra={"artifact_id": preprod_artifact.id},
        )
        return

    commit_comparison: CommitComparison = preprod_artifact.commit_comparison
    if not commit_comparison.head_sha or not commit_comparison.head_repo_name:
        # if the user provided git information, we should have a head_sha and head_repo_name
        logger.error(
            "preprod.status_checks.create.missing_git_info",
            extra={
                "artifact_id": preprod_artifact.id,
                "commit_comparison_id": commit_comparison.id,
            },
        )
        return

    # Get all artifacts for this commit across all projects in the organization
    all_artifacts = list(preprod_artifact.get_sibling_artifacts_for_commit())

    client, repository = _get_status_check_client(preprod_artifact.project, commit_comparison)
    if not client or not repository:
        # logging handled in _get_status_check_client. for now we can be lax about users potentially
        # not having their repos integrated into Sentry
        return

    provider = _get_status_check_provider(
        client,
        commit_comparison.provider,
        preprod_artifact.project.organization_id,
        preprod_artifact.project.organization.slug,
        repository.integration_id,
    )
    if not provider:
        logger.info(
            "preprod.status_checks.create.not_supported_provider",
            extra={"provider": commit_comparison.provider},
        )
        return

    size_metrics_map: dict[int, list[PreprodArtifactSizeMetrics]] = {}
    if all_artifacts:
        artifact_ids = [artifact.id for artifact in all_artifacts]
        size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=artifact_ids,
        ).select_related("preprod_artifact")

        for metrics in size_metrics_qs:
            if metrics.preprod_artifact_id not in size_metrics_map:
                size_metrics_map[metrics.preprod_artifact_id] = []
            size_metrics_map[metrics.preprod_artifact_id].append(metrics)

    status = _compute_overall_status(all_artifacts, size_metrics_map)

    title, subtitle, summary = format_status_check_messages(all_artifacts, size_metrics_map, status)

    target_url = get_preprod_artifact_url(preprod_artifact)

    completed_at: datetime | None = None
    if GITHUB_STATUS_CHECK_STATUS_MAPPING[status] == GitHubCheckStatus.COMPLETED:
        completed_at = preprod_artifact.date_updated

    try:
        check_id = provider.create_status_check(
            repo=commit_comparison.head_repo_name,
            sha=commit_comparison.head_sha,
            status=status,
            title=title,
            subtitle=subtitle,
            text=None,  # TODO(telkins): add text field support
            summary=summary,
            external_id=str(preprod_artifact.id),
            target_url=target_url,
            started_at=preprod_artifact.date_added,
            completed_at=completed_at,
        )
    except Exception as e:
        _update_posted_status_check(preprod_artifact, check_type="size", success=False, error=e)
        raise

    if check_id is None:
        logger.error(
            "preprod.status_checks.create.failed",
            extra={
                "artifact_id": preprod_artifact.id,
                "organization_id": preprod_artifact.project.organization_id,
                "organization_slug": preprod_artifact.project.organization.slug,
            },
        )
        _update_posted_status_check(preprod_artifact, check_type="size", success=False)
        return

    _update_posted_status_check(
        preprod_artifact, check_type="size", success=True, check_id=check_id
    )

    logger.info(
        "preprod.status_checks.create.success",
        extra={
            "artifact_id": preprod_artifact.id,
            "status": status.value,
            "check_id": check_id,
            "organization_id": preprod_artifact.project.organization_id,
            "organization_slug": preprod_artifact.project.organization.slug,
        },
    )


def _update_posted_status_check(
    preprod_artifact: PreprodArtifact,
    check_type: str,
    success: bool,
    check_id: str | None = None,
    error: Exception | None = None,
) -> None:
    """Update the posted_status_checks field in the artifact's extras."""
    with transaction.atomic(router.db_for_write(PreprodArtifact)):
        artifact = PreprodArtifact.objects.select_for_update().get(id=preprod_artifact.id)
        extras = artifact.extras or {}

        posted_status_checks = extras.get("posted_status_checks", {})

        check_result: dict[str, Any] = {"success": success}
        if success and check_id:
            check_result["check_id"] = check_id
        if not success:
            check_result["error_type"] = _get_error_type(error).value

        posted_status_checks[check_type] = check_result
        extras["posted_status_checks"] = posted_status_checks
        artifact.extras = extras
        artifact.save(update_fields=["extras"])


def _get_error_type(error: Exception | None) -> StatusCheckErrorType:
    """Determine the error type from an exception."""
    if error is None:
        return StatusCheckErrorType.UNKNOWN
    if isinstance(error, IntegrationConfigurationError):
        return StatusCheckErrorType.INTEGRATION_ERROR
    if isinstance(error, ApiError):
        return StatusCheckErrorType.API_ERROR
    return StatusCheckErrorType.UNKNOWN


class StatusCheckErrorType(StrEnum):
    """Error types for status check creation failures."""

    UNKNOWN = "unknown"
    """An unknown error occurred (e.g., API returned null check_id)."""
    API_ERROR = "api_error"
    """A retryable API error (5xx, rate limit, transient issues)."""
    INTEGRATION_ERROR = "integration_error"
    """An integration configuration error (permissions, invalid request, etc.)."""


def _compute_overall_status(
    artifacts: list[PreprodArtifact], size_metrics_map: dict[int, list[PreprodArtifactSizeMetrics]]
) -> StatusCheckStatus:
    if not artifacts:
        raise ValueError("Cannot compute status for empty artifact list")

    states = {artifact.state for artifact in artifacts}

    if PreprodArtifact.ArtifactState.FAILED in states:
        return StatusCheckStatus.FAILURE
    elif (
        PreprodArtifact.ArtifactState.UPLOADING in states
        or PreprodArtifact.ArtifactState.UPLOADED in states
    ):
        return StatusCheckStatus.IN_PROGRESS
    elif all(state == PreprodArtifact.ArtifactState.PROCESSED for state in states):
        # All artifacts are processed, but we need to check if size analysis (if present) is complete
        for artifact in artifacts:
            size_metrics_list = size_metrics_map.get(artifact.id, [])
            if size_metrics_list:
                for size_metrics in size_metrics_list:
                    if size_metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED:
                        return StatusCheckStatus.FAILURE
                    elif (
                        size_metrics.state != PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
                    ):
                        return StatusCheckStatus.IN_PROGRESS
        return StatusCheckStatus.SUCCESS
    else:
        return StatusCheckStatus.IN_PROGRESS


def _get_status_check_client(
    project: Project, commit_comparison: CommitComparison
) -> tuple[StatusCheckClient, Repository] | tuple[None, None]:
    """Get status check client for the project's integration.

    Returns None for expected failure cases (missing repo, integration, etc).
    Raises exceptions for unexpected errors that should be handled upstream.
    """
    repository = Repository.objects.filter(
        organization_id=project.organization_id,
        name=commit_comparison.head_repo_name,
        provider=f"integrations:{commit_comparison.provider}",
    ).first()
    if not repository:
        logger.info(
            "preprod.status_checks.create.no_repository",
            extra={
                "commit_comparison": commit_comparison.id,
                "project_id": project.id,
                "provider": commit_comparison.provider,
            },
        )
        return None, None

    if not repository.integration_id:
        logger.info(
            "preprod.status_checks.create.no_integration_id",
            extra={
                "repository": repository.id,
                "project_id": project.id,
            },
        )
        return None, None

    integration: RpcIntegration | None = integration_service.get_integration(
        integration_id=repository.integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        logger.info(
            "preprod.status_checks.create.no_integration",
            extra={
                "repository": repository.id,
                "integration_id": repository.integration_id,
                "project_id": project.id,
            },
        )
        return None, None

    installation: IntegrationInstallation = integration.get_installation(
        organization_id=project.organization_id
    )
    client = installation.get_client()

    if not isinstance(client, StatusCheckClient):
        logger.info(
            "preprod.status_checks.create.not_status_check_client",
            extra={
                "repository": repository.id,
                "project_id": project.id,
            },
        )
        return None, None

    return client, repository


def _get_status_check_provider(
    client: StatusCheckClient,
    provider: str | None,
    organization_id: int,
    organization_slug: str,
    integration_id: int,
) -> _StatusCheckProvider | None:
    if provider == IntegrationProviderSlug.GITHUB:
        return _GitHubStatusCheckProvider(
            client, provider, organization_id, organization_slug, integration_id
        )
    else:
        return None


class _StatusCheckProvider(ABC):
    """
    The APIs for creating status checks are slightly different for each provider.
    This provides a common interface for creating status checks.
    """

    def __init__(
        self,
        client: StatusCheckClient,
        provider_key: str,
        organization_id: int,
        organization_slug: str,
        integration_id: int,
    ):
        self.client = client
        self.provider_key = provider_key
        self.organization_id = organization_id
        self.organization_slug = organization_slug
        self.integration_id = integration_id

    def _create_scm_interaction_event(self) -> SCMIntegrationInteractionEvent:
        return SCMIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.CREATE_STATUS_CHECK,
            provider_key=self.provider_key,
            organization_id=self.organization_id,
            integration_id=self.integration_id,
        )

    @abstractmethod
    def create_status_check(
        self,
        repo: str,
        sha: str,
        status: StatusCheckStatus,
        title: str,
        subtitle: str,
        text: str | None,
        summary: str,
        external_id: str,
        started_at: datetime,
        completed_at: datetime | None = None,
        target_url: str | None = None,
    ) -> str | None:
        """Create a status check using provider-specific format."""
        raise NotImplementedError


class _GitHubStatusCheckProvider(_StatusCheckProvider):
    def create_status_check(
        self,
        repo: str,
        sha: str,
        status: StatusCheckStatus,
        title: str,
        subtitle: str,
        text: str | None,
        summary: str,
        external_id: str,
        started_at: datetime,
        completed_at: datetime | None = None,
        target_url: str | None = None,
    ) -> str | None:
        with self._create_scm_interaction_event().capture() as lifecycle:
            mapped_status = GITHUB_STATUS_CHECK_STATUS_MAPPING.get(status)
            mapped_conclusion = GITHUB_STATUS_CHECK_CONCLUSION_MAPPING.get(status)

            if not mapped_status:
                logger.error(
                    "preprod.status_checks.create.invalid_status_mapping",
                    extra={"status": status},
                )
                return None

            truncated_text = _truncate_to_byte_limit(text, GITHUB_MAX_TEXT_FIELD_LENGTH)
            truncated_summary = _truncate_to_byte_limit(summary, GITHUB_MAX_SUMMARY_FIELD_LENGTH)

            if text and truncated_text and len(truncated_text) != len(text):
                logger.warning(
                    "preprod.status_checks.create.text_truncated",
                    extra={
                        "original_bytes": len(text.encode("utf-8")),
                        "truncated_bytes": len(truncated_text.encode("utf-8")),
                        "organization_id": self.organization_id,
                        "organization_slug": self.organization_slug,
                    },
                )

            if summary and truncated_summary and len(truncated_summary) != len(summary):
                logger.warning(
                    "preprod.status_checks.create.summary_truncated",
                    extra={
                        "original_bytes": len(summary.encode("utf-8")),
                        "truncated_bytes": len(truncated_summary.encode("utf-8")),
                        "organization_id": self.organization_id,
                        "organization_slug": self.organization_slug,
                    },
                )

            check_data: dict[str, Any] = {
                "name": title,
                "head_sha": sha,
                "external_id": external_id,
                "output": {
                    "title": subtitle,
                    "summary": truncated_summary,
                },
                "status": mapped_status.value,
            }

            if truncated_text:
                check_data["output"]["text"] = truncated_text

            if mapped_conclusion:
                check_data["conclusion"] = mapped_conclusion.value

            if started_at:
                check_data["started_at"] = started_at.isoformat()

            if completed_at:
                check_data["completed_at"] = completed_at.isoformat()

            if target_url:
                if target_url.startswith("http"):
                    check_data["details_url"] = target_url
                else:
                    logger.warning(
                        "preprod.status_checks.create.invalid_target_url",
                        extra={"target_url": target_url},
                    )

            try:
                response = self.client.create_check_run(repo=repo, data=check_data)
                check_id = response.get("id")
                return str(check_id) if check_id else None
            except ApiError as e:
                lifecycle.record_failure(e)
                # Only convert specific permission 403s as IntegrationConfigurationError
                # GitHub can return 403 for various reasons (rate limits, temporary issues, permissions)
                if e.code == 403:
                    error_message = str(e).lower()
                    if (
                        "resource not accessible" in error_message
                        or "insufficient" in error_message
                        or "permission" in error_message
                    ):
                        logger.exception(
                            "preprod.status_checks.create.insufficient_permissions",
                            extra={
                                "organization_id": self.organization_id,
                                "integration_id": self.integration_id,
                                "repo": repo,
                                "error_message": str(e),
                            },
                        )
                        raise IntegrationConfigurationError(
                            "GitHub App lacks permissions to create check runs. "
                            "Please ensure the app has the required permissions and that "
                            "the organization has accepted any updated permissions."
                        ) from e
                elif e.code and 400 <= e.code < 500 and e.code != 429:
                    logger.exception(
                        "preprod.status_checks.create.client_error",
                        extra={
                            "organization_id": self.organization_id,
                            "integration_id": self.integration_id,
                            "repo": repo,
                            "status_code": e.code,
                        },
                    )
                    raise IntegrationConfigurationError(
                        f"GitHub API returned {e.code} client error when creating check run"
                    ) from e

                # For non-permission 403s, 429s, 5xx, and other error
                raise


# See: https://docs.github.com/en/rest/checks/runs?apiVersion=2022-11-28#create-a-check-run
GITHUB_MAX_SUMMARY_FIELD_LENGTH = 65535
GITHUB_MAX_TEXT_FIELD_LENGTH = 65535


def _truncate_to_byte_limit(text: str | None, byte_limit: int) -> str | None:
    """Truncate text to fit within byte limit while ensuring valid UTF-8."""
    if not text:
        return text

    TRUNCATE_AMOUNT = 10

    encoded = text.encode("utf-8")
    if len(encoded) <= byte_limit:
        return text

    if byte_limit <= TRUNCATE_AMOUNT:
        # This shouldn't happen, but just in case.
        truncated = encoded[:byte_limit].decode("utf-8", errors="ignore")
        return truncated

    # Truncate to byte_limit - 10 (a bit of wiggle room) to make room for "..."
    # Note: this can break formatting you have and is more of a catch-all,
    # broken formatting is better than silently erroring for the user.
    # Templating logic itself should try to more contextually trim the content if possible.
    truncated = encoded[: byte_limit - TRUNCATE_AMOUNT].decode("utf-8", errors="ignore")
    return truncated + "..."


GITHUB_STATUS_CHECK_STATUS_MAPPING: dict[StatusCheckStatus, GitHubCheckStatus] = {
    StatusCheckStatus.ACTION_REQUIRED: GitHubCheckStatus.COMPLETED,
    StatusCheckStatus.IN_PROGRESS: GitHubCheckStatus.IN_PROGRESS,
    StatusCheckStatus.FAILURE: GitHubCheckStatus.COMPLETED,
    StatusCheckStatus.NEUTRAL: GitHubCheckStatus.COMPLETED,
    StatusCheckStatus.SUCCESS: GitHubCheckStatus.COMPLETED,
}

GITHUB_STATUS_CHECK_CONCLUSION_MAPPING: dict[StatusCheckStatus, GitHubCheckConclusion | None] = {
    StatusCheckStatus.ACTION_REQUIRED: GitHubCheckConclusion.ACTION_REQUIRED,
    StatusCheckStatus.IN_PROGRESS: None,
    StatusCheckStatus.FAILURE: GitHubCheckConclusion.FAILURE,
    StatusCheckStatus.NEUTRAL: GitHubCheckConclusion.NEUTRAL,
    StatusCheckStatus.SUCCESS: GitHubCheckConclusion.SUCCESS,
}
