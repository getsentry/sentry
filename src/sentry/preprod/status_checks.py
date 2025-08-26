from __future__ import annotations

import logging
from abc import ABC, abstractmethod

from sentry.integrations.github.commit_status import GitHubCheckConclusion, GitHubCheckStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.status_check import StatusCheckClient
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.commitcomparison import CommitComparison
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)

SIZE_ANALYZER_TITLE = "Sentry Size Analysis"


def update_preprod_size_analysis_status_on_upload(preprod_artifact: PreprodArtifact) -> None:
    """Create IN_PROGRESS status when artifact upload is complete."""
    text = f"⏳ Build {preprod_artifact.id} for {preprod_artifact.app_id} is processing..."
    return _create_preprod_status_check(
        preprod_artifact=preprod_artifact,
        status=GitHubCheckStatus.IN_PROGRESS,
        title=SIZE_ANALYZER_TITLE,
        text=text,
        summary=f"Build {preprod_artifact.id} for `{preprod_artifact.app_id}` is processing...",
    )


def update_preprod_size_analysis_status_on_completion(
    preprod_artifact: PreprodArtifact, target_url: str | None = None
) -> None:
    """Update status to SUCCESS when artifact processing is complete."""
    text = f"✅ Build {preprod_artifact.id} processed successfully."
    return _create_preprod_status_check(
        preprod_artifact=preprod_artifact,
        status=GitHubCheckStatus.COMPLETED,
        conclusion=GitHubCheckConclusion.SUCCESS,
        title=SIZE_ANALYZER_TITLE,
        text=text,
        summary=f"Build {preprod_artifact.id} for `{preprod_artifact.app_id}` processed successfully.",
        target_url=target_url,
    )


def update_preprod_size_analysis_status_on_failure(
    preprod_artifact: PreprodArtifact, error_message: str | None = None
) -> None:
    """Update status to FAILURE when artifact processing fails."""
    text = f"❌ Build {preprod_artifact.id} failed. Error: {error_message}"
    return _create_preprod_status_check(
        preprod_artifact=preprod_artifact,
        status=GitHubCheckStatus.COMPLETED,
        conclusion=GitHubCheckConclusion.FAILURE,
        title=SIZE_ANALYZER_TITLE,
        text=text,
        summary=f"Build {preprod_artifact.id} for `{preprod_artifact.app_id}` failed.",
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
    try:
        if not _create_preprod_status_check_impl(
            preprod_artifact, status, title, text, summary, conclusion, target_url
        ):
            logger.error(
                "Failed to create preprod status check",
                extra={"artifact_id": preprod_artifact.id, "status": status.value},
            )
    except Exception as e:
        logger.exception(
            "Failed to create preprod status check",
            extra={
                "artifact_id": preprod_artifact.id,
                "status": status.value,
                "error": str(e),
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
            "No commit comparison found for preprod artifact",
            extra={"artifact_id": preprod_artifact.id},
        )
        return False

    commit_comparison: CommitComparison = preprod_artifact.commit_comparison
    if not commit_comparison.head_sha or not commit_comparison.head_repo_name:
        logger.info(
            "Missing required git information for status check, skipping",
            extra={
                "artifact_id": preprod_artifact.id,
                "commit_comparison_id": commit_comparison.id,
            },
        )
        return False

    client = _get_status_check_client(preprod_artifact.project, commit_comparison)
    if not client:
        return False

    provider = _get_status_check_provider(client, commit_comparison.provider)
    if not provider:
        return False

    provider.create_status_check(
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
        "Created preprod status check",
        extra={
            "artifact_id": preprod_artifact.id,
            "status": status.value,
            "repo": commit_comparison.head_repo_name,
            "sha": commit_comparison.head_sha,
        },
    )
    return True


def _get_status_check_client(
    project: Project, commit_comparison: CommitComparison
) -> StatusCheckClient | None:
    try:
        repository = Repository.objects.get(
            organization_id=project.organization_id,
            name=commit_comparison.head_repo_name,
            provider=f"integrations:{commit_comparison.provider}",
        )
        if not repository.integration_id:
            logger.info(
                "Repository found but no integration_id set",
                extra={
                    "provider": commit_comparison.provider,
                    "project_id": project.id,
                    "repo_name": commit_comparison.head_repo_name,
                },
            )
            return None

        integration = Integration.objects.get(id=repository.integration_id)
        installation = integration.get_installation(organization_id=project.organization_id)
        client = installation.get_client()

        if not isinstance(client, StatusCheckClient):
            logger.info(
                "Client is not a status check client, skipping",
                extra={
                    "provider": commit_comparison.provider,
                    "project_id": project.id,
                    "repo_name": commit_comparison.head_repo_name,
                },
            )
            return None

        return client

    except Repository.DoesNotExist:
        logger.info(
            "No repository found for provider and repo name",
            extra={
                "provider": commit_comparison.provider,
                "project_id": project.id,
                "repo_name": commit_comparison.head_repo_name,
            },
        )
        return None
    except Integration.DoesNotExist:
        logger.info(
            "Integration not found for repository",
            extra={
                "provider": commit_comparison.provider,
                "project_id": project.id,
                "repo_name": commit_comparison.head_repo_name,
            },
        )
        return None
    except Exception as e:
        logger.exception(
            "Failed to get status check client",
            extra={
                "provider": commit_comparison.provider,
                "project_id": project.id,
                "repo_name": commit_comparison.head_repo_name,
                "error": str(e),
            },
        )
        return None


def _get_status_check_provider(
    client: StatusCheckClient, provider: str
) -> _StatusCheckProvider | None:
    """Get the appropriate status check provider for the given provider type."""
    if provider == IntegrationProviderSlug.GITHUB:
        return _GitHubStatusCheckProvider(client)
    else:
        logger.info(
            "Status checks not currently supported for provider, skipping",
            extra={"provider": provider},
        )
        return None


class _StatusCheckProvider(ABC):
    """
    The APIs for creating status checks are slightly different for each provider.
    This abstract class provides a common interface for creating status checks.
    """

    def __init__(self, client: StatusCheckClient):
        self.client = client

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
    ) -> None:
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
    ) -> None:

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

        self.client.create_check_run(repo=repo, data=check_data)
