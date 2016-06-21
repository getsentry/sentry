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

logger = get_logger()

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
    def emit(self, record):
        kwargs = {
            'name': record.name,
        }
        if record.exc_info:
            kwargs['exc_info'] = record.exc_info

        if record.args:
            kwargs.update(flatten_args(record.args))

        # HACK(JTCunning): Calling structlog.log instead of the corresponding level
        # methods steps on the toes of django client loggers and their testing components.
        log = getattr(logger, logging.getLevelName(record.levelno).lower(), None)
        if log:
            log(record.msg, **kwargs)
        else:
            super(StructLogHandler, self).emit(record)


_plain_types = (basestring, int, long, bool, type(None))


def flatten_args(args):
    out = {}

    if isinstance(args, _plain_types):
        args = [args]

    if isinstance(args, dict):
        for k, v in args.iteritems():
            if isinstance(v, _plain_types):
                out['args.' + k] = v
            else:
                out['args.' + k] = repr(v)
    elif isinstance(args, (list, tuple)):
        for i, v in enumerate(args):
            if isinstance(v, _plain_types):
                out['args.' + str(i)] = v
            else:
                out['args.' + str(i)] = repr(v)
    else:
        out['args.0'] = repr(args)

    return out
