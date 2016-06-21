"""
sentry.logging.audit
~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging

from django.utils.encoding import force_bytes

from sentry import options

logger = logging.getLogger('sentry.audit')


def log(log_obj, logger=logger):
    """
    Will either log an encoded dictionary or just a line.
    """
    if isinstance(log_obj, dict):
        logger.info(encode(**log_obj))
    else:
        logger.info(force_bytes(
            log_obj,
            strings_only=True,
            errors='replace'
        ))


def encode(**kwargs):
    """
    Force complex objects into strings so log formatters don't
    error out when serializing.
    """
    return {
        key: force_bytes(value, strings_only=True, errors='replace')
        for key, value
        in kwargs.iteritems()
        if value is not None
    }


def log_entry(entry, logger=logger):
    """
    Give an AuditLogEntry object to the audit logger.
    """
    fmt = options.get('system.logging-format')
    if fmt == 'human':
        log(
            u'[Audit Log] [{org}] {user} {note}'.format(
                org=entry.organization_id,
                user=entry.actor_label,
                note=entry.get_note(),
            ),
            logger=logger,
        )
    elif fmt == 'machine':
        log(
            dict(
                organization_id=entry.organization_id,
                actor_id=entry.actor_id,
                actor_key=entry.actor_key,
                target_object=entry.target_object,
                target_user_id=entry.target_user_id,
                event=entry.get_event_display(),
                ip_address=entry.ip_address,
                data=entry.data,
                datetime=entry.datetime,
            ),
            logger=logger,
        )
