"""
sentry.search.base
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import


class SearchBackend(object):
    def __init__(self, **options):
        pass

    def index(self, group, event):
        pass

    def remove(self, group):
        pass

    def query(self, **kwargs):
        raise NotImplementedError
