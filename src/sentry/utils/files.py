from __future__ import absolute_import

import os
import time
import zlib

from sentry import features, options
from sentry.models import MAX_FILE_SIZE


ONE_DAY = 60 * 60 * 24
ONE_DAY_AND_A_HALF = int(ONE_DAY * 1.5)


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


def clear_cached_files(cache_path):
    try:
        cache_folders = os.listdir(cache_path)
    except OSError:
        return

    cutoff = int(time.time()) - ONE_DAY_AND_A_HALF

    for cache_folder in cache_folders:
        cache_folder = os.path.join(cache_path, cache_folder)
        try:
            items = os.listdir(cache_folder)
        except OSError:
            continue
        for cached_file in items:
            cached_file = os.path.join(cache_folder, cached_file)
            try:
                mtime = os.path.getmtime(cached_file)
            except OSError:
                continue
            if mtime < cutoff:
                try:
                    os.remove(cached_file)
                except OSError:
                    pass
