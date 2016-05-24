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
fmt = options.get('system.logging-format')


def log(**kwargs):
    logger.info(encode(**kwargs))


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


def log_entry(entry):
    """
    Give an AuditLogEntry object to the audit logger.
    """
    if fmt is 'human':
        logger.info(
            "[Audit Log] [{org}] {user} {note}".format(
                org=entry.organization.name,
                user=entry.actor.username,
                note=entry.get_note(),
            )
        )
    elif fmt is 'machine':
        logger.info(encode(
            organization_id=entry.organization_id,
            actor_id=entry.actor_id,
            actor_key=entry.actor_key,
            target_object=entry.target_object,
            target_user_id=entry.target_user_id,
            event=entry.get_event_display(),
            ip_address=entry.ip_address,
            data=entry.data,
            datetime=entry.datetime,
        ))
