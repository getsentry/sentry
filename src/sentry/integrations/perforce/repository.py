from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

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

        depot_path = config["identifier"]  # e.g., //depot or //depot/project

        # Validate depot exists and is accessible
        try:
            # Create a minimal repo-like object for client
            class MockRepo:
                def __init__(self, depot_path):
                    self.config = {"depot_path": depot_path}

            mock_repo = MockRepo(depot_path)

            # Try to check depot access
            result = client.check_file(mock_repo, "...", None)

            if result is None:
                # Try getting depot info
                depots = client.get_depots()
                depot_name = depot_path.strip("/").split("/")[0]

                if not any(d["name"] == depot_name for d in depots):
                    raise IntegrationError(
                        f"Depot not found or no access: {depot_path}. Available depots: {[d['name'] for d in depots]}"
                    )

        except IntegrationError:
            # Re-raise validation errors so user sees them
            raise
        except Exception:
            # Catch only connection/P4 errors - depot might be valid but temporarily unreachable
            pass

        config["external_id"] = depot_path
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
                # Get changes between start and end
                # P4 doesn't have native compare, so get changes up to end_sha
                changes = client.get_changes(f"{depot_path}/...", max_changes=100, start_cl=end_sha)

                # Filter to only changes after start_sha
                if changes:
                    start_cl_num = int(start_sha) if start_sha.isdigit() else 0
                    # Filter out invalid changelist data
                    filtered_changes = []
                    for c in changes:
                        try:
                            if int(c["change"]) > start_cl_num:
                                filtered_changes.append(c)
                        except (TypeError, ValueError, KeyError):
                            # Skip malformed changelist data
                            continue
                    changes = filtered_changes

            return self._format_commits(changes, depot_path)

        except Exception as e:
            logger.exception(
                "perforce.compare_commits.error",
                extra={"repo": repo.name, "start": start_sha, "end": end_sha, "error": str(e)},
            )
            return []

    def _format_commits(
        self, changelists: list[dict[str, Any]], depot_path: str
    ) -> Sequence[Mapping[str, Any]]:
        """
        Format Perforce changelists into Sentry commit format.

        Args:
            changelists: List of changelist dictionaries from P4
            depot_path: Depot path

        Returns:
            List of commits in Sentry format
        """
        commits = []

        for cl in changelists:
            try:
                # Handle potentially null/invalid time field
                time_value = cl.get("time") or 0
                try:
                    time_int = int(time_value)
                except (TypeError, ValueError):
                    time_int = 0

                # Format timestamp (P4 time is Unix timestamp)
                timestamp = self.format_date(time_int)

                commits.append(
                    {
                        "id": str(cl["change"]),  # Changelist number as commit ID
                        "repository": depot_path,
                        "author_email": f"{cl.get('user', 'unknown')}@perforce",  # P4 doesn't store email
                        "author_name": cl.get("user", "unknown"),
                        "message": cl.get("desc", ""),
                        "timestamp": timestamp,
                        "patch_set": [],  # Could fetch with 'p4 describe' if needed
                    }
                )
            except (KeyError, TypeError) as e:
                # Skip malformed changelist data
                logger.warning(
                    "perforce.format_commits.invalid_data",
                    extra={"changelist": cl, "error": str(e)},
                )
                continue

        return commits

    def pull_request_url(self, repo: Repository, pull_request: PullRequest) -> str:
        """
        Get URL for pull request.
        Perforce doesn't have native PRs, but might integrate with Swarm.
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
