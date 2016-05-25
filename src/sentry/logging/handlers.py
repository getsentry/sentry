"""
sentry.logging.handlers
~~~~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging

from django.utils.encoding import force_bytes


logger = logging.getLogger('sentry.audit')


class TuringHandler(logging.StreamHandler):
    """
    Decides between logging human or machine readable lines.
    """
    def emit(self, record):
        context = record.args
        # Check to make sure someone is following the rules.
        if isinstance(context, dict):
            from sentry.options import get
            _emit = getattr(self, 'emit_' + get('system.logging-format'))
            _emit(record, context)
        else:
            super(TuringHandler, self).emit(record)

    def emit_human(self, record, context):
        context = record.args
        # Check to make sure someone is following the rules.
        if isinstance(context, dict):
            # If you're reading this in a KeyError, you didn't provide
            # a kv pair in your context that your format is expecting.
            record.msg = record.msg.format(**context)

        super(TuringHandler, self).emit(record)

    def emit_machine(self, record, context):

        context.update({
            'levelname': record.levelname,
            'name': record.name,
        })

        record.msg = self.encode(context)

        super(TuringHandler, self).emit(record)

    def encode(self, kwargs):
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
