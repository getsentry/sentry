"""
sentry.utils.files
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import


def compress_file(fp):
    chunks = []
    for chunk in fp.chunks():
        chunks.append(chunk)
    return b''.join(chunks)
