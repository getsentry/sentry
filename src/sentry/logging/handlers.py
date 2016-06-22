"""
sentry.logging.handlers
~~~~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from simplejson import JSONEncoder
import logging

from structlog import get_logger
from structlog.processors import _json_fallback_handler

_default_encoder = JSONEncoder(
    separators=(',', ':'),
    ignore_nan=True,
    skipkeys=False,
    ensure_ascii=True,
    check_circular=True,
    allow_nan=True,
    indent=None,
    encoding='utf-8',
    default=_json_fallback_handler,
).encode


class JSONRenderer(object):
    def __call__(self, logger, name, event_dict):
        return _default_encoder(event_dict)


class StructLogHandler(logging.StreamHandler):
    def emit(self, record, logger=get_logger()):
        kwargs = {
            'name': record.name,
        }
        if record.exc_info:
            kwargs['exc_info'] = record.exc_info

        if record.args:
            # record.args inside of LogRecord.__init__ gets unrolled
            # if it's the shape `({},)`, a single item dictionary.
            # so we need to check for this, and re-wrap it because
            # down the line of structlog, it's expected to be this
            # original shape.
            if isinstance(record.args, (tuple, list)):
                kwargs['positional_args'] = record.args
            else:
                kwargs['positional_args'] = (record.args,)

        # HACK(JTCunning): Calling structlog.log instead of the corresponding level
        # methods steps on the toes of django client loggers and their testing components.
        try:
            log = getattr(logger, logging.getLevelName(record.levelno).lower())
        except AttributeError:
            super(StructLogHandler, self).emit(record)
        else:
            log(record.msg, **kwargs)
