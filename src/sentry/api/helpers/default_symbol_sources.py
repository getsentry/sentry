from typing import cast

from django.conf import settings

from sentry.constants import ENABLED_CONSOLE_PLATFORMS_DEFAULT
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.projects.services.project import RpcProject

DEFAULT_SYMBOL_SOURCES = {
    "electron": ["ios", "microsoft", "electron"],
    "javascript-electron": ["ios", "microsoft", "electron"],
    "unity": ["ios", "microsoft", "android", "nuget", "unity", "nvidia", "ubuntu"],
    "unreal": ["ios", "microsoft", "android", "nvidia", "ubuntu"],
    "godot": ["ios", "microsoft", "android", "nuget", "nvidia", "ubuntu"],
    "nintendo-switch": ["nintendo"],
}


def set_default_symbol_sources(
    project: Project | RpcProject, organization: Organization | None = None
) -> None:
    """
    Sets default symbol sources for a project based on its platform.

    For sources with platform restrictions (e.g., console platforms), this function checks
    if the organization has access to the required platform before adding the source.

    Args:
        project: The project to configure symbol sources for
        organization: Optional organization (fetched from project if not provided)
    """
    if not project.platform or project.platform not in DEFAULT_SYMBOL_SOURCES:
        return

    # Get organization from project if not provided
    if organization is None:
        if isinstance(project, Project):
            organization = project.organization
        else:
            # For RpcProject, fetch organization by ID
            try:
                organization = Organization.objects.get_from_cache(id=project.organization_id)
            except Organization.DoesNotExist:
                # If organization doesn't exist, cannot set defaults
                return

    # Get default sources for this platform
    source_keys = DEFAULT_SYMBOL_SOURCES[project.platform]

    # Get enabled console platforms once (optimization to avoid repeated DB calls)
    enabled_console_platforms = organization.get_option(
        "sentry:enabled_console_platforms", ENABLED_CONSOLE_PLATFORMS_DEFAULT
    )

    # Filter sources based on platform restrictions and organization access
    enabled_sources = []
    for source_key in source_keys:
        source_config = settings.SENTRY_BUILTIN_SOURCES.get(source_key)

        # If source exists in config, check for platform restrictions
        if source_config:
            required_platforms: list[str] | None = cast(
                "list[str] | None", source_config.get("platforms")
            )
            if required_platforms:
                # Source is platform-restricted - check if org has access
                # Only add source if org has access to at least one of the required platforms
                has_access = any(
                    platform in enabled_console_platforms for platform in required_platforms
                )
                if not has_access:
                    continue

        # Include the source (either it passed platform check or doesn't exist in config)
        # Non-existent sources will be filtered out at runtime in sources.py
        enabled_sources.append(source_key)

    # Always update the option for recognized platforms, even if empty
    # This ensures platform-specific defaults override epoch defaults
    project.update_option("sentry:builtin_symbol_sources", enabled_sources)
