from sentry.models.organization import Organization
from sentry.utils.console_platforms import organization_has_console_platform_access


def has_tempest_access(organization: Organization | None) -> bool:
    if not organization:
        return False

    return organization_has_console_platform_access(organization, "playstation")
