"""
sentry.logging.audit
~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging

from django.utils.encoding import force_bytes

logger = logging.getLogger('sentry.audit')


def log(**kwargs):
    logger.info(encode(**kwargs))


def encode(**kwargs):
    """
    Force complex objects into strings so log formatters don't
    error out when serializing.
    """
    return dict(
        (key, force_bytes(value, strings_only=True, errors='replace'))
        for (key, value)
        in kwargs.items()
    )
