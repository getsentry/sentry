"""
sentry.logging
~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from structlog import get_logger


class LoggingFormat(object):
    HUMAN = 'human'
    MACHINE = 'machine'


def bind(name, **kwargs):
    """
    Syntactic sugar for binding arbitrary kv pairs to a given logger instantiated from
    logging.getLogger instead of structlog.get_logger.
    """
    return get_logger(name=name).bind(**kwargs)
