"""
sentry.logging.audit
~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging

from sentry.models import AuditLogEntry
from sentry.models import AuditLogEntryEvents as events  # flake8: noqa

logger = logging.getLogger('sentry.audit')


def log(**kwargs):
    """
    Logs all AuditLogEntry kwargs to disk and creates the entry.
    """
    logger.info(kwargs)
    return AuditLogEntry.objects.create(**kwargs)
