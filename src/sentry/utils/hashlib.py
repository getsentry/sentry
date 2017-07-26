"""
sentry.utils.hashlib
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from hashlib import md5 as _md5
from hashlib import sha1 as _sha1

from django.utils.encoding import force_bytes


def md5_text(x):
    return _md5(force_bytes(x, errors='replace'))


def sha1_text(x):
    return _sha1(force_bytes(x, errors='replace'))
