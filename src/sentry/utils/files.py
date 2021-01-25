import zlib

from sentry import features, options
from sentry.models import MAX_FILE_SIZE


def compress_file(fp, level=6):
    compressor = zlib.compressobj(level)
    z_chunks = []
    chunks = []
    for chunk in fp.chunks():
        chunks.append(chunk)
        z_chunks.append(compressor.compress(chunk))
    return (b"".join(z_chunks) + compressor.flush(), b"".join(chunks))


def get_max_file_size(organization):
    """Returns the maximum allowed debug file size for this organization."""
    if features.has("organizations:large-debug-files", organization):
        return MAX_FILE_SIZE
    else:
        return options.get("system.maximum-file-size")
