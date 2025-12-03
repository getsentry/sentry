from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
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

        except IntegrationError:
            # Re-raise validation errors so user sees them
            raise
        except Exception as e:
            # Log and re-raise connection/P4 errors
            # We cannot create a repository if we can't validate the depot exists
            logger.exception(
                "perforce.get_repository_data.depot_validation_failed",
                extra={"depot_path": depot_path.path},
            )
            raise IntegrationError(
                f"Failed to validate depot: {depot_path.path}. "
                f"Please check your Perforce server connection and credentials."
            ) from e

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
            "url": f"p4:{depot_path}",
            "config": {
                "depot_path": depot_path,
                "name": depot_path,
            },
            "integration_id": data["integration_id"],
        }

    def _extract_commit_info(
        self,
        change: P4ChangeInfo,
        depot_path: str,
        client: PerforceClient,
        user_cache: dict[str, P4UserInfo | None],
    ) -> P4CommitInfo:
        """
        Extract commit info from a Perforce changelist.

        Args:
            change: Perforce changelist info
            depot_path: Depot path for repository field
            client: Perforce client for user lookups
            user_cache: Cache of user info to avoid redundant lookups

        Returns:
            Commit info in Sentry format
        """
        # Handle potentially null/invalid time field
        time_value = change.get("time") or 0
        try:
            time_int = int(time_value)
        except (TypeError, ValueError) as e:
            logger.warning(
                "perforce.format_commits.invalid_time_value",
                extra={
                    "changelist": change.get("change"),
                    "time_value": time_value,
                    "error": str(e),
                },
            )
            time_int = 0

        # Convert Unix timestamp to ISO 8601 format
        timestamp = datetime.fromtimestamp(time_int, tz=timezone.utc).isoformat()

        # Get user information from Perforce using shared helper
        username = change.get("user", "unknown")
        author_email, author_name = client.get_author_info_from_cache(username, user_cache)

        return P4CommitInfo(
            id=str(change["change"]),
            repository=depot_path,
            author_email=author_email,
            author_name=author_name,
            message=change.get("desc", ""),
            timestamp=timestamp,
            patch_set=[],
        )

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

        for change in changelists:
            try:
                commit = self._extract_commit_info(change, depot_path, client, user_cache)
                commits.append(commit)
            except (KeyError, TypeError) as e:
                logger.warning(
                    "perforce.format_commits.invalid_changelist_data",
                    extra={
                        "changelist": change.get("change"),
                        "depot_path": depot_path,
                        "error": str(e),
                        "error_type": type(e).__name__,
                    },
                )
                continue

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

    def pull_request_url(self, repo: Repository, pull_request: PullRequest) -> str | None:
        """
        Get URL for pull request.
        Perforce doesn't have native pull requests.
        """
        return None

    def repository_external_slug(self, repo: Repository) -> str:
        """Get external slug for repository."""
        return repo.config.get("depot_path", repo.name)
