from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

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
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.preprod.tasks.create_preprod_status_check",
    queue="integrations",
    silo_mode=SiloMode.REGION,
    retry=Retry(times=3),
    taskworker_config=TaskworkerConfig(
        namespace=integrations_tasks,
        processing_deadline_duration=30,
    ),
)
def create_preprod_status_check_task(preprod_artifact_id: int) -> None:
    try:
        preprod_artifact = PreprodArtifact.objects.get(id=preprod_artifact_id)
    except PreprodArtifact.DoesNotExist:
        logger.exception(
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
    )
    if check_id is None:
        logger.error(
            "preprod.status_checks.create.failed",
            extra={"artifact_id": preprod_artifact.id},
        )
        return

    logger.info(
        "preprod.status_checks.create.success",
        extra={
            "artifact_id": preprod_artifact.id,
            "status": status.value,
            "check_id": check_id,
        },
    )


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
    client: StatusCheckClient, provider: str | None, organization_id: int, integration_id: int
) -> _StatusCheckProvider | None:
    if provider == IntegrationProviderSlug.GITHUB:
        return _GitHubStatusCheckProvider(client, provider, organization_id, integration_id)
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
        integration_id: int,
    ):
        self.client = client
        self.provider_key = provider_key
        self.organization_id = organization_id
        self.integration_id = integration_id

    def _create_scm_interaction_event(self):
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

            check_data: dict[str, Any] = {
                "name": title,
                "head_sha": sha,
                "external_id": external_id,
                "output": {
                    "title": subtitle,
                    "summary": summary,
                },
                "status": mapped_status.value,
            }

            if text:
                check_data["output"]["text"] = text

            if mapped_conclusion:
                check_data["conclusion"] = mapped_conclusion.value

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
            except Exception as e:
                lifecycle.record_failure(e)
                return None


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
