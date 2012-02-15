"""
sentry.services.base
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


class Service(object):
    name = ''

    def __init__(self, debug=False):
        self.debug = debug
