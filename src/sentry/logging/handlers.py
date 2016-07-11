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


class HumanRenderer(object):
    def __call__(self, logger, name, event_dict):
        level = event_dict.pop('level')
        real_level = (level.upper()
            if isinstance(level, basestring)
            else logging.getLevelName(level)
        )
        base = '[%s] %s: %s' % (
            real_level,
            event_dict.pop('name', 'root'),
            event_dict.pop('event'),
        )
        join = ' '.join(k + '=' + repr(v)
               for k, v in event_dict.iteritems())
        return '%s %s' % (base, join)


class StructLogHandler(logging.StreamHandler):
    def emit(self, record, logger=get_logger()):
        # This may seem a little gross, but when logging with the RootLogger,
        # anything passed into 'extra' gets turned into a real kwarg
        throwaways = [
            'threadName', 'thread', 'created', 'process', 'processName', 'args',
            'module', 'filename', 'levelno', 'exc_text', 'msg', 'pathname', 'lineno',
            'funcName', 'relativeCreated', 'levelname', 'msecs',
        ]

        kwargs = {
            (k if k not in throwaways else 'popme'): v
            for k, v in record.__dict__.iteritems()
        }
        kwargs.pop('popme')
        kwargs.update({
            'level': record.levelno,
            'event': record.msg,
        })

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

        logger.log(**kwargs)
