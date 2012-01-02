"""
sentry
~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


class BaseProcessor(object):

    def post_processing(self, event):
        '''
        Process an event after it has been saved.
        '''
        pass
