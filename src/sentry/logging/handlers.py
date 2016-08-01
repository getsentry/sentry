"""
sentry.logging.handlers
~~~~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six
import logging

from django.utils.timezone import now
from simplejson import JSONEncoder
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

# These are values that come default from logging.LogRecord.
# They are defined here: https://github.com/python/cpython/blob/2.7/Lib/logging/__init__.py#L237-L310
throwaways = frozenset((
    'threadName', 'thread', 'created', 'process', 'processName', 'args',
    'module', 'filename', 'levelno', 'exc_text', 'msg', 'pathname', 'lineno',
    'funcName', 'relativeCreated', 'levelname', 'msecs',
))


class JSONRenderer(object):
    def __call__(self, logger, name, event_dict):
        return _default_encoder(event_dict)


class HumanRenderer(object):
    def __call__(self, logger, name, event_dict):
        level = event_dict.pop('level')
        real_level = (level.upper()
            if isinstance(level, six.string_types)
            else logging.getLevelName(level)
        )
        base = '%s [%s] %s: %s' % (
            now().strftime('%H:%M:%S'),
            real_level,
            event_dict.pop('name', 'root'),
            event_dict.pop('event', ''),
        )
        join = ' '.join(k + '=' + repr(v)
               for k, v in six.iteritems(event_dict))
        return '%s%s' % (base, (' (%s)' % join if join else ''))


class StructLogHandler(logging.StreamHandler):
    def emit(self, record, logger=get_logger()):
        # If anyone wants to use the 'extra' kwarg to provide context within
        # structlog, we have to strip all of the default attributes from
        # a record because the RootLogger will take the 'extra' dictionary
        # and just turn them into attributes.
        kwargs = {
            k: v
            for k, v in six.iteritems(vars(record))
            if k not in throwaways
            and v is not None
        }
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
