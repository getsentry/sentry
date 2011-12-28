"""
sentry.commands.utils
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from optparse import make_option

opt = make_option


def options(*options):
    def wrapped(func):
        func.options = options
        return func
    return wrapped


def consume_args(func):
    func.consume_args = True
    return func
