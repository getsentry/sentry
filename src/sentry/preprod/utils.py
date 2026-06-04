from __future__ import annotations

import re
from typing import NamedTuple


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


def format_bytes_base10(size_bytes: int) -> str:
    """Format file size using decimal (base-10) units. Matches the frontend implementation of formatBytesBase10."""
    units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    threshold = 1000

    if size_bytes < threshold:
        return f"{size_bytes} {units[0]}"

    u = 0
    number = float(size_bytes)
    max_unit = len(units) - 1
    while number >= threshold and u < max_unit:
        number /= threshold
        u += 1

    return f"{number:.1f} {units[u]}"
