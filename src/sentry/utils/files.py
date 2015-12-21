"""
sentry.utils.files
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import zlib


def compress_file(fp, level=6):
    compressor = zlib.compressobj(level)
    z_chunks = []
    chunks = []
    for chunk in fp.chunks():
        chunks.append(chunk)
        z_chunks.append(compressor.compress(chunk))
    return (b''.join(z_chunks) + compressor.flush(), b''.join(chunks))
