"""
sentry
~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.processors import BaseProcessor


class ConsoleProcessor(BaseProcessor):

    def post_processing(self, event):
        print 'Post processing event:'
        print '  ', event
