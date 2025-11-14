from __future__ import annotations

import re
from typing import int, NamedTuple


class ParsedReleaseVersion(NamedTuple):
    """Parsed components of a release version string."""

    app_id: str
    build_version: str


def parse_release_version(release_version: str) -> ParsedReleaseVersion | None:
    """
    Parse release version string into app_id and build_version components.

    Expected formats:
    1. "app_id@version+build_number" -> returns (app_id, version)
    2. "app_id@version" -> returns (app_id, version)

    Args:
        release_version: The release version string to parse

    Returns:
        ParsedReleaseVersion with app_id and build_version, or None if parsing fails
    """
    # Parse app_id and version, ignoring build_number if present
    version_match = re.match(r"^([^@]+)@([^+]+)(?:\+.*)?$", release_version)

    if version_match:
        app_id, build_version = version_match.groups()
        return ParsedReleaseVersion(app_id=app_id, build_version=build_version)

    return None
