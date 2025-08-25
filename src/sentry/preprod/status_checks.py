from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

from sentry.integrations.source_code_management.commit_context import CommitContextClient
from sentry.integrations.source_code_management.commit_status import (
    CommitStatus,
    GitHubStatusMapper,
    GitLabStatusMapper,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.commitcomparison import CommitComparison
from sentry.models.integrations.integration import Integration
from sentry.models.project import Project
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)


class StatusCheckProvider(ABC):
    """Abstract base class for provider-specific status check implementations."""

    def __init__(self, client: CommitContextClient):
        self.client = client

    @abstractmethod
    def create_status_check(
        self,
        repo: str,
        sha: str,
        state: CommitStatus,
        title: str,
        preprod_artifact: PreprodArtifact,
        target_url: str | None = None,
    ) -> Any:
        """Create a status check using provider-specific format."""
        pass


class GitHubStatusCheckProvider(StatusCheckProvider):
    """GitHub-specific status check provider using Check Runs API."""

    def create_status_check(
        self,
        repo: str,
        sha: str,
        state: CommitStatus,
        title: str,
        preprod_artifact: PreprodArtifact,
        target_url: str | None = None,
    ) -> Any:
        # Generate summary based on state
        if state == CommitStatus.PENDING:
            summary = f"Build processing for artifact {preprod_artifact.id}"
        elif state == CommitStatus.SUCCESS:
            summary = f"Build completed successfully for artifact {preprod_artifact.id}"
        elif state in (CommitStatus.FAILURE, CommitStatus.ERROR):
            summary = f"Build failed for artifact {preprod_artifact.id}"
        else:
            summary = f"Build status update for artifact {preprod_artifact.id}"

        # Get status and conclusion from mapper
        status_data = GitHubStatusMapper.to_check_run_data(state)

        check_data = {
            "name": f"Sentry Preprod Build ({preprod_artifact.project.slug})",
            "head_sha": sha,
            "external_id": str(preprod_artifact.id),
            "output": {
                "title": title,
                "summary": summary,
            },
        }

        # Add status and optional conclusion
        check_data.update(status_data)

        # Add details URL if provided
        if target_url:
            check_data["details_url"] = target_url

        return self.client.create_check_run(repo=repo, data=check_data)


class GitLabStatusCheckProvider(StatusCheckProvider):
    """GitLab-specific status check provider using commit status API."""

    def create_status_check(
        self,
        repo: str,
        sha: str,
        state: CommitStatus,
        title: str,
        preprod_artifact: PreprodArtifact,
        target_url: str | None = None,
    ) -> Any:
        # Map state to GitLab status
        gitlab_state = GitLabStatusMapper.to_provider_status(state)

        status_data = {
            "state": gitlab_state,
            "name": f"sentry/preprod-{preprod_artifact.project.slug}",
            "description": title,
        }

        if target_url:
            status_data["target_url"] = target_url

        return self.client.create_status(repo=repo, sha=sha, data=status_data)


def update_preprod_status_on_upload(preprod_artifact: PreprodArtifact) -> None:
    """Create IN_PROGRESS status when artifact upload is complete."""
    text = f"⏳ Build {preprod_artifact.id} for {preprod_artifact.app_id} is processing..."
    return _create_preprod_status_check(
        preprod_artifact,
        CommitStatus.PENDING,
        text,
    )


def update_preprod_status_on_completion(
    preprod_artifact: PreprodArtifact, target_url: str | None = None
) -> None:
    """Update status to SUCCESS when artifact processing is complete."""
    text = f"✅ Build {preprod_artifact.id} processed successfully."
    return _create_preprod_status_check(
        preprod_artifact,
        CommitStatus.SUCCESS,
        text,
        target_url,
    )


def update_preprod_status_on_failure(
    preprod_artifact: PreprodArtifact, error_message: str | None = None
) -> None:
    """Update status to FAILURE when artifact processing fails."""
    text = f"❌ Build {preprod_artifact.id} failed. Error: {error_message}"
    return _create_preprod_status_check(preprod_artifact, CommitStatus.FAILURE, text)


def _create_preprod_status_check(
    preprod_artifact: PreprodArtifact, state: CommitStatus, text: str, target_url: str | None = None
) -> None:
    if not _create_preprod_status_check_impl(preprod_artifact, state, text, target_url):
        logger.error(
            "Failed to create preprod status check",
            extra={"artifact_id": preprod_artifact.id, "state": state.value},
        )


def _create_preprod_status_check_impl(
    preprod_artifact: PreprodArtifact,
    state: CommitStatus,
    description: str,
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
            "Missing required git information for status check",
            extra={
                "artifact_id": preprod_artifact.id,
                "commit_comparison_id": commit_comparison.id,
            },
        )
        return False

    client = _get_status_check_client(preprod_artifact.project, commit_comparison)
    if not client:
        return False

    try:
        # Get the appropriate provider for this integration
        provider = _get_status_check_provider(client, commit_comparison.provider)
        if provider:
            provider.create_status_check(
                repo=commit_comparison.head_repo_name,
                sha=commit_comparison.head_sha,
                state=state,
                title=description,
                preprod_artifact=preprod_artifact,
                target_url=target_url,
            )
        else:
            # Fallback to generic status API
            context = f"sentry/preprod-{preprod_artifact.project.slug}"
            status_data = _get_status_data(
                state, context, description, target_url, commit_comparison.provider
            )
            client.create_status(
                repo=commit_comparison.head_repo_name,
                sha=commit_comparison.head_sha,
                data=status_data,
            )

        logger.info(
            "Created preprod status check",
            extra={
                "artifact_id": preprod_artifact.id,
                "state": state.value,
                "repo": commit_comparison.head_repo_name,
                "sha": commit_comparison.head_sha,
            },
        )
        return True
    except Exception as e:
        logger.exception(
            "Failed to create preprod status check",
            extra={
                "artifact_id": preprod_artifact.id,
                "state": state.value,
                "error": str(e),
                "repo": commit_comparison.head_repo_name,
                "sha": commit_comparison.head_sha,
            },
        )
        return False


def _get_status_check_provider(
    client: CommitContextClient, provider: str
) -> StatusCheckProvider | None:
    """Get the appropriate status check provider for the given provider type."""
    if provider == IntegrationProviderSlug.GITHUB:
        return GitHubStatusCheckProvider(client)
    elif provider == IntegrationProviderSlug.GITLAB:
        return GitLabStatusCheckProvider(client)
    else:
        return None


def _get_status_check_client(
    project: Project, commit_comparison: CommitComparison
) -> CommitContextClient | None:
    """Get the appropriate status check client for the project's integration."""
    try:
        if commit_comparison.provider == IntegrationProviderSlug.GITHUB:
            from sentry.integrations.github.client import GitHubBaseClient

            integration = Integration.objects.get(
                provider=IntegrationProviderSlug.GITHUB, organizations__in=[project.organization_id]
            )
            return GitHubBaseClient(integration=integration)
        elif commit_comparison.provider == IntegrationProviderSlug.GITLAB:
            from sentry.integrations.gitlab.client import GitLabApiClient

            integration = Integration.objects.get(
                provider=IntegrationProviderSlug.GITLAB, organizations__in=[project.organization_id]
            )
            return GitLabApiClient(integration=integration)
        else:
            logger.info(
                "Status checks not currently supported for provider",
                extra={"provider": commit_comparison.provider, "project_id": project.id},
            )
            return None
    except Integration.DoesNotExist:
        logger.info(
            "No integration found for provider",
            extra={"provider": commit_comparison.provider, "project_id": project.id},
        )
        return None
    except Exception as e:
        logger.exception(
            "Failed to get status check client",
            extra={
                "provider": commit_comparison.provider,
                "project_id": project.id,
                "error": str(e),
            },
        )
        return None


def _get_status_data(
    state: CommitStatus,
    context: str,
    description: str,
    target_url: str | None = None,
    provider: str | None = None,
) -> dict[str, Any]:
    """Create status data dict for fallback commit status API."""
    # This is only used for providers that don't have create_preprod_status_check method
    data = {
        "state": state.value,
        "context": context,
        "description": description,
    }
    if target_url:
        data["target_url"] = target_url

    return data
