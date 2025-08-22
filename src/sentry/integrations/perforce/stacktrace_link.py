from __future__ import annotations

import logging
from typing import Any, NamedTuple

from sentry.models.organization import Organization
from sentry.models.project import Project

logger = logging.getLogger(__name__)


class PerforceCodeMapping(NamedTuple):
    """
    Perforce-specific code mapping that uses depot paths instead of repositories.

    Unlike traditional repository-based code mappings, Perforce uses depot paths
    which are centralized paths in the Perforce server.
    """

    depot_name: str
    folder_path: str  # Path from depot root
    stacktrace_root: str
    source_path: str


def get_perforce_stacktrace_link(
    project: Project,
    organization: Organization,
    filepath: str,
    perforce_integrations: list[Any],
    ctx: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Generate stacktrace link results for Perforce integrations.

    Args:
        project: The Sentry project
        organization: The organization
        filepath: The file path from the stacktrace
        perforce_integrations: List of Perforce integrations
        ctx: Additional context from stacktrace

    Returns:
        Dict containing source_url, config, error, etc.
    """
    if not perforce_integrations:
        return {
            "source_url": None,
            "config": None,
            "error": "no_perforce_integrations",
            "src_path": None,
        }

    # For now, use the first Perforce integration
    # TODO: In the future, we may want to try multiple integrations
    perforce_integration = perforce_integrations[0]

    try:
        # Get depot name from integration metadata
        depot_name = perforce_integration.metadata.get("depot_name", "main")
        base_url = perforce_integration.metadata.get("base_url", "")

        # Create a simple Perforce code mapping
        # This is a basic implementation - in practice, you'd want to:
        # 1. Have stored code mappings for the project
        # 2. Match the filepath against known mappings
        # 3. Transform the stacktrace path to depot path

        # For now, assume a simple mapping where the filepath in stacktrace
        # corresponds to a path in the depot
        if not filepath.startswith("//"):
            # Convert relative path to depot path
            depot_path = f"//{depot_name}/{filepath.lstrip('/')}"
        else:
            depot_path = filepath

        # Generate source URL using the integration's format_source_url method
        source_url = None
        if hasattr(perforce_integration, "format_source_url"):
            source_url = perforce_integration.format_source_url(depot_path)
        else:
            # Fallback URL construction
            source_url = f"{base_url.rstrip('/')}/files{depot_path}"

        # Create a mock config similar to what repository-based integrations return
        mock_config = {
            "id": f"perforce-{perforce_integration.id}",
            "repository": {
                "name": f"{depot_name} (Perforce)",
                "id": f"perforce-depot-{depot_name}",
            },
            "provider": {
                "key": "perforce",
                "name": "Perforce",
            },
            "stackRoot": "",  # Perforce uses depot paths
            "sourceRoot": f"//{depot_name}/",
            "automaticallyGenerated": True,  # For now, mark as auto-generated
        }

        return {
            "source_url": source_url,
            "config": mock_config,
            "error": None,
            "src_path": depot_path,
        }

    except Exception as e:
        logger.exception("Error generating Perforce stacktrace link")
        return {
            "source_url": None,
            "config": None,
            "error": f"perforce_integration_error: {str(e)}",
            "src_path": None,
        }


def create_perforce_code_mapping(
    organization: Organization,
    project: Project,
    depot_name: str,
    folder_path: str,
    stacktrace_root: str,
    source_path: str,
) -> PerforceCodeMapping:
    """
    Create a new Perforce code mapping.

    Args:
        organization: The organization
        project: The project
        depot_name: Name of the Perforce depot
        folder_path: Path from depot root to the source folder
        stacktrace_root: Root path in stacktraces that should be mapped
        source_path: Source path in the depot

    Returns:
        PerforceCodeMapping instance
    """
    return PerforceCodeMapping(
        depot_name=depot_name,
        folder_path=folder_path,
        stacktrace_root=stacktrace_root,
        source_path=source_path,
    )
