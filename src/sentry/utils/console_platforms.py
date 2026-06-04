from sentry.constants import ENABLED_CONSOLE_PLATFORMS_DEFAULT
from sentry.models.organization import Organization


def organization_has_console_platform_access(organization: Organization, platform: str) -> bool:
    """
    Check if an organization has access to a specific console platform.

    Args:
        organization: The organization to check
        platform: The console platform (e.g., 'nintendo-switch', 'playstation', 'xbox')

    Returns:
        True if the organization has access to the console platform, False otherwise
    """
    enabled_console_platforms = organization.get_option(
        "sentry:enabled_console_platforms", ENABLED_CONSOLE_PLATFORMS_DEFAULT
    )
    return platform in enabled_console_platforms
