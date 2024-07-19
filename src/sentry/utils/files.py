from __future__ import annotations

from typing import TYPE_CHECKING

from sentry import features, options
from sentry.models.files.utils import MAX_FILE_SIZE

if TYPE_CHECKING:
    from sentry.models.organization import Organization


def get_max_file_size(organization: Organization) -> int:
    """Returns the maximum allowed debug file size for this organization."""
    if features.has("organizations:large-debug-files", organization):
        return MAX_FILE_SIZE
    else:
        return options.get("system.maximum-file-size")
