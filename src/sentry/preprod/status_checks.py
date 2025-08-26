from __future__ import annotations

import logging
from abc import ABC, abstractmethod

from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.github.commit_status import GitHubCheckConclusion, GitHubCheckStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.source_code_management.status_check import StatusCheckClient
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.commitcomparison import CommitComparison
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.preprod.models import PreprodArtifact
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import json

logger = logging.getLogger(__name__)

SIZE_ANALYZER_TITLE = "Sentry Size Analysis"  # TODO(preprod): translate


def trigger_update_preprod_size_analysis_status_on_upload_task(
    preprod_artifact: PreprodArtifact,
) -> None:
    """Create IN_PROGRESS status when artifact upload is complete."""
    _create_preprod_status_check.delay(
        preprod_artifact=preprod_artifact,
        status=GitHubCheckStatus.IN_PROGRESS,
        title=SIZE_ANALYZER_TITLE,
        text=f"⏳ Build {preprod_artifact.id} for {preprod_artifact.app_id} is processing...",
        summary=f"Build {preprod_artifact.id} for `{preprod_artifact.app_id}` is processing...",
    )


def trigger_update_preprod_size_analysis_status_on_completion_task(
    preprod_artifact: PreprodArtifact,
) -> None:
    """Update status to SUCCESS when artifact processing is complete."""
    _create_preprod_status_check.delay(
        preprod_artifact=preprod_artifact,
        status=GitHubCheckStatus.COMPLETED,
        conclusion=GitHubCheckConclusion.SUCCESS,
        title=SIZE_ANALYZER_TITLE,
        text=f"✅ Build {preprod_artifact.id} processed successfully.",
        summary=f"Build {preprod_artifact.id} for `{preprod_artifact.app_id}` processed successfully.",
        target_url=None,  # TODO(preprod): add link to frontend
    )


def trigger_update_preprod_size_analysis_status_on_failure_task(
    preprod_artifact: PreprodArtifact, error_message: str | None = None
) -> None:
    """Update status to FAILURE when artifact processing fails."""
    _create_preprod_status_check.delay(
        preprod_artifact=preprod_artifact,
        status=GitHubCheckStatus.COMPLETED,
        conclusion=GitHubCheckConclusion.FAILURE,
        title=SIZE_ANALYZER_TITLE,
        text=f"❌ Build {preprod_artifact.id} failed. Error: {error_message}",
        summary=f"Build {preprod_artifact.id} for `{preprod_artifact.app_id}` failed.",
    )


@instrumented_task(
    name="sentry.preprod.tasks.create_preprod_status_check",
    queue="assemble",
    silo_mode=SiloMode.REGION,
    retry=Retry(times=3),
    taskworker_config=TaskworkerConfig(
        namespace=integrations_tasks,
        processing_deadline_duration=30,
    ),
)
def _create_preprod_status_check(
    preprod_artifact: PreprodArtifact,
    status: GitHubCheckStatus,
    title: str,
    text: str,
    summary: str,
    conclusion: GitHubCheckConclusion | None = None,
    target_url: str | None = None,
) -> None:
    logger.info(
        "preprod.status_checks.create.start",
        extra={
            "artifact_id": preprod_artifact.id,
            "status": status.value,
            "conclusion": conclusion.value if conclusion else None,
        },
    )

    try:
        if not _create_preprod_status_check_impl(
            preprod_artifact, status, title, text, summary, conclusion, target_url
        ):
            logger.error(
                "preprod.status_checks.create.error",
                extra={
                    "artifact_id": preprod_artifact.id,
                    "status": status.value,
                    "conclusion": conclusion.value if conclusion else None,
                },
            )
    except Exception:
        logger.exception(
            "preprod.status_checks.create.exception",
            extra={
                "artifact_id": preprod_artifact.id,
                "status": status.value,
                "conclusion": conclusion.value if conclusion else None,
            },
        )


def _create_preprod_status_check_impl(
    preprod_artifact: PreprodArtifact,
    status: GitHubCheckStatus,
    title: str,
    text: str,
    summary: str,
    conclusion: GitHubCheckConclusion | None = None,
    target_url: str | None = None,
) -> bool:
    if not preprod_artifact.commit_comparison:
        logger.info(
            "preprod.status_checks.create.no_commit_comparison",
            extra={"artifact_id": preprod_artifact.id},
        )
        return False

    commit_comparison: CommitComparison = preprod_artifact.commit_comparison
    if not commit_comparison.head_sha or not commit_comparison.head_repo_name:
        logger.info(
            "preprod.status_checks.create.missing_git_info",
            extra={
                "artifact_id": preprod_artifact.id,
                "commit_comparison_id": commit_comparison.id,
            },
        )
        return False

    client, repository = _get_status_check_client(preprod_artifact.project, commit_comparison)
    if not client or not repository:
        return False

    provider = _get_status_check_provider(
        client,
        commit_comparison.provider,
        preprod_artifact.project.organization_id,
        repository.integration_id,
    )
    if not provider:
        return False

    check_id = provider.create_status_check(
        repo=commit_comparison.head_repo_name,
        sha=commit_comparison.head_sha,
        status=status,
        title=title,
        text=text,
        summary=summary,
        external_id=str(preprod_artifact.id),
        target_url=target_url,
        conclusion=conclusion,
    )

    logger.info(
        "preprod.status_checks.create.success",
        extra={
            "artifact_id": preprod_artifact.id,
            "status": status.value,
            "conclusion": conclusion.value if conclusion else None,
            "check_id": check_id,
        },
    )
    return True


def _get_status_check_client(
    project: Project, commit_comparison: CommitComparison
) -> tuple[StatusCheckClient, Repository] | tuple[None, None]:
    """Get status check client for the project's integration.

    Returns None for expected failure cases (missing repo, integration, etc).
    Raises exceptions for unexpected errors that should be handled upstream.
    """
    try:
        repository = Repository.objects.get(
            organization_id=project.organization_id,
            name=commit_comparison.head_repo_name,
            provider=f"integrations:{commit_comparison.provider}",
        )
    except Repository.DoesNotExist:
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

    try:
        integration: Integration = Integration.objects.get(id=repository.integration_id)
    except Integration.DoesNotExist:
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
                "installation": installation.id,
                "project_id": project.id,
            },
        )
        return None, None

    return client, repository


def _get_status_check_provider(
    client: StatusCheckClient, provider: str, organization_id: int, integration_id: int
) -> _StatusCheckProvider | None:
    """Get the appropriate status check provider for the given provider type."""
    if provider == IntegrationProviderSlug.GITHUB:
        return _GitHubStatusCheckProvider(client, provider, organization_id, integration_id)
    else:
        logger.info(
            "preprod.status_checks.create.not_supported_provider",
            extra={"provider": provider},
        )
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
        status: GitHubCheckStatus,
        title: str,
        text: str,
        summary: str,
        external_id: str,
        target_url: str | None = None,
        conclusion: GitHubCheckConclusion | None = None,
    ) -> str | None:
        """Create a status check using provider-specific format."""
        raise NotImplementedError


class _GitHubStatusCheckProvider(_StatusCheckProvider):
    def create_status_check(
        self,
        repo: str,
        sha: str,
        status: GitHubCheckStatus,
        title: str,
        text: str,
        summary: str,
        external_id: str,
        target_url: str | None = None,
        conclusion: GitHubCheckConclusion | None = None,
    ) -> str | None:
        with self._create_scm_interaction_event().capture() as _:
            check_data = {
                "name": title,
                "head_sha": sha,
                "external_id": external_id,
                "output": {
                    "title": title,
                    "summary": summary,
                    "text": text,
                },
                "status": status.value,
            }

            # Only include conclusion when status is completed
            if status == GitHubCheckStatus.COMPLETED and conclusion:
                check_data["conclusion"] = conclusion.value

            if target_url:
                check_data["details_url"] = target_url

            response = self.client.create_check_run(repo=repo, data=check_data)
            response_json = json.loads(response)
            check_id = response_json.get("id")
            return str(check_id)
