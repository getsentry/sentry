from sentry import features, options
from sentry.models.files.utils import MAX_FILE_SIZE


def get_max_file_size(organization):
    """Returns the maximum allowed debug file size for this organization."""
    if features.has("organizations:large-debug-files", organization):
        return MAX_FILE_SIZE
    else:
        return options.get("system.maximum-file-size")
