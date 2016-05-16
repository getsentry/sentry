"""
sentry.logging.formatters
~~~~~~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from logging import Formatter
from traceback import format_tb

from django.utils.encoding import force_bytes
from msgpack import packb


class MessagePackFormatter(Formatter):
    """
    Return a packed dictionary.

    Will pack the dictionary or the String representation of the message.
    """
    def format(self, record):
        pack = record.msg if isinstance(record.msg, dict) else {
            'msg': force_bytes(record.msg, errors='replace')
        }
        pack['levelname'] = record.levelname
        if record.exc_info:
            pack['traceback'] = format_tb(record.exc_info[-1])

        return packb(pack)
