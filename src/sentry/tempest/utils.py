from typing import int
from sentry.models.organization import Organization


def has_tempest_access(organization: Organization | None) -> bool:

    if not organization:
        return False

    enabled_platforms = organization.get_option("sentry:enabled_console_platforms", [])
    has_playstation_access = "playstation" in enabled_platforms

    return has_playstation_access
