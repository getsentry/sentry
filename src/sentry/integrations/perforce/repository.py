from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from sentry.integrations.perforce.client import (
    P4ChangeInfo,
    P4CommitInfo,
    P4DepotPath,
    P4UserInfo,
    PerforceClient,
)
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.plugins.providers.integration_repository import RepositoryConfig
from sentry.shared_integrations.exceptions import IntegrationError

logger = logging.getLogger(__name__)


class PerforceRepositoryProvider(IntegrationRepositoryProvider):
    """Repository provider for Perforce integration."""

    name = "Perforce"
    repo_provider = "perforce"

    def _get_client_from_repo(self, repo: Repository) -> PerforceClient:
        """
        Get Perforce client from repository.

        Args:
            repo: Repository instance

        Returns:
            PerforceClient instance

        Raises:
            NotImplementedError: If integration not found
        """
        integration_id = repo.integration_id
        if integration_id is None:
            raise NotImplementedError("Perforce integration requires an integration_id")

        integration = integration_service.get_integration(integration_id=integration_id)
        if integration is None:
            raise NotImplementedError("Integration not found")

        installation = integration.get_installation(organization_id=repo.organization_id)
        return installation.get_client()

    def get_repository_data(
        self, organization: Organization, config: dict[str, Any]
    ) -> Mapping[str, Any]:
        """
        Validate and return repository data.

        Args:
            organization: Organization instance
            config: Repository configuration from user

        Returns:
            Repository configuration dictionary
        """
        installation = self.get_installation(config.get("installation"), organization.id)
        client = installation.get_client()

        depot_path = P4DepotPath(config["identifier"])  # e.g., //depot or //depot/project

        # Validate depot exists and is accessible
        try:
            depots = client.get_depots()

            if not any(d["name"] == depot_path.depot_name() for d in depots):
                raise IntegrationError(
                    f"Depot not found or no access: {depot_path.path}. Available depots: {[d['name'] for d in depots]}"
                )

        except Exception:
            # Don't fail - depot might be valid but empty
            pass

        config["external_id"] = depot_path.path
        config["integration_id"] = installation.model.id

        return config

    def build_repository_config(
        self, organization: RpcOrganization, data: dict[str, Any]
    ) -> RepositoryConfig:
        """
        Build repository configuration for database storage.

        Args:
            organization: Organization RPC object
            data: Repository data

        Returns:
            Repository configuration
        """
        depot_path = data["identifier"]

        return {
            "name": depot_path,
            "external_id": data["external_id"],
            "url": f"p4://{depot_path}",
            "config": {
                "depot_path": depot_path,
                "name": depot_path,
            },
            "integration_id": data["integration_id"],
        }

    def compare_commits(
        self, repo: Repository, start_sha: str | None, end_sha: str
    ) -> Sequence[Mapping[str, Any]]:
        """
        Compare commits (changelists) between two versions.

        Args:
            repo: Repository instance
            start_sha: Starting changelist number (or None for initial)
            end_sha: Ending changelist number

        Returns:
            List of changelist dictionaries
        """
        integration_id = repo.integration_id
        if integration_id is None:
            raise NotImplementedError("Perforce integration requires an integration_id")

        integration = integration_service.get_integration(integration_id=integration_id)
        if integration is None:
            raise NotImplementedError("Integration not found")

        installation = integration.get_installation(organization_id=repo.organization_id)
        client = installation.get_client()

        depot_path = repo.config.get("depot_path", repo.name)

        try:
            # Get changelists in range
            if start_sha is None:
                # Get last N changes
                changes = client.get_changes(f"{depot_path}/...", max_changes=20)
            else:
                # Get changes between start and end (exclusive start, inclusive end)
                # P4 -e flag returns changes >= specified CL, so we get all recent changes
                # and filter to range (start_sha, end_sha]
                changes = client.get_changes(f"{depot_path}/...", max_changes=100)

                # Filter to only changes in range: start_sha < change <= end_sha
                if changes:
                    start_cl_num = int(start_sha) if start_sha.isdigit() else 0
                    changes = [c for c in changes if int(c["change"]) > start_cl_num]

            return self._format_commits(changes, depot_path)

        except Exception as e:
            logger.exception(
                "perforce.compare_commits.error",
                extra={"repo": repo.name, "start": start_sha, "end": end_sha, "error": str(e)},
            )
            return []

    def _format_commits(
        self, changelists: Sequence[P4ChangeInfo], depot_path: str, client: PerforceClient
    ) -> list[P4CommitInfo]:
        """
        Format Perforce changelists into Sentry commit format.

        Args:
            changelists: List of changelist dictionaries from P4
            depot_path: Depot path
            client: Perforce client instance

        Returns:
            List of commits in Sentry format
        """
        commits: list[P4CommitInfo] = []
        user_cache: dict[str, P4UserInfo | None] = {}

        for cl in changelists:
            # Format timestamp (P4 time is Unix timestamp)
            timestamp = self.format_date(int(cl["time"]))

            commits.append(
                {
                    "id": str(cl["change"]),  # Changelist number as commit ID
                    "repository": depot_path,
                    "author_email": f"{cl['user']}@perforce",  # P4 doesn't store email
                    "author_name": cl["user"],
                    "message": cl["desc"],
                    "timestamp": timestamp,
                    "patch_set": [],  # Could fetch with 'p4 describe' if needed
                }
            )

        return commits

    def compare_commits(
        self, repo: Repository, start_sha: str | None, end_sha: str
    ) -> Sequence[Mapping[str, Any]]:
        """
        Compare commits (changelists) between two versions.

        Used for release tracking when users manually specify changelist numbers.

        Args:
            repo: Repository instance
            start_sha: Starting changelist number (or None for initial)
            end_sha: Ending changelist number

        Returns:
            List of changelist dictionaries in Sentry commit format
        """
        client = self._get_client_from_repo(repo)
        depot_path = repo.config.get("depot_path", repo.name)

        try:
            # Convert changelist numbers from strings to integers
            # In Perforce, SHAs are changelist numbers
            start_cl = int(start_sha) if start_sha else None
            end_cl = int(end_sha)

            # Get changelists in range (start_sha, end_sha]
            changes = client.get_changes(
                f"{depot_path}/...",
                max_changes=20,
                start_cl=start_cl,
                end_cl=end_cl,
            )

            return self._format_commits(changes, depot_path, client)

        except (ValueError, TypeError) as e:
            # Log conversion errors for debugging
            logger.exception(
                "perforce.compare_commits.invalid_changelist",
                extra={
                    "start_sha": start_sha,
                    "end_sha": end_sha,
                    "depot_path": depot_path,
                    "repo_id": repo.id,
                    "error": str(e),
                },
            )
            return []
        except Exception as e:
            logger.exception(
                "perforce.compare_commits.failed",
                extra={
                    "start_sha": start_sha,
                    "end_sha": end_sha,
                    "depot_path": depot_path,
                    "repo_id": repo.id,
                    "integration_id": repo.integration_id,
                    "error": str(e),
                    "error_type": type(e).__name__,
                },
            )
            return []

    def pull_request_url(self, repo: Repository, pull_request: PullRequest) -> str:
        """
        Get URL for pull request.
        Perforce doesn't have native pull requests.
        """
        web_url = None
        if repo.integration_id:
            integration = integration_service.get_integration(integration_id=repo.integration_id)
            if integration:
                web_url = integration.metadata.get("web_url")

        if web_url:
            # Swarm review URL format
            return f"{web_url}/reviews/{pull_request.key}"

        return f"p4://{repo.name}@{pull_request.key}"

    def repository_external_slug(self, repo: Repository) -> str:
        """Get external slug for repository."""
        return repo.config.get("depot_path", repo.name)
