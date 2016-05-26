"""
sentry.logging.handlers
~~~~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging

from django.utils.encoding import force_bytes
from raven.contrib.django.models import client as Raven


logger = logging.getLogger('sentry.audit')


class TuringHandler(logging.StreamHandler):
    """
    Decides between logging human or machine readable lines.
    """
    # Overridden by system.logging-format
    fmt = 'human'

    def emit(self, record):
        context = record.args
        # Check to make sure someone is following the rules.
        if not context:
            context = record.msg
        try:
            _emit = getattr(self, TuringHandler.fmt)
            _emit(record, context)
        except Exception:
            # Pretty much never fail silently.
            Raven.captureException()
            super(TuringHandler, self).emit(record)

    def human(self, record, context):
        # If you're reading this in a KeyError, you didn't provide
        # a kv pair in your context that your format is expecting.
        record.msg = record.msg.format(**context)

        super(TuringHandler, self).emit(record)

    def machine(self, record, context):
        if isinstance(context, str):
            context = {'event': context}
        context.update({
            'levelname': record.levelname,
            'loggername': record.name,
        })

        record.msg = self.encode(context)

        super(TuringHandler, self).emit(record)

    def encode(self, context):
        """
        Force complex objects into strings so log formatters don't
        error out when serializing.
        """
        return {
            key: force_bytes(value, strings_only=True, errors='replace')
            for key, value
            in context.iteritems()
            if value is not None
        }
