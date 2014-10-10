"""
sentry.search.base
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import


class SearchBackend(object):
    def __init__(self, **options):
        pass

    def index(self, event):
        raise NotImplementedError

    def query(self, project, query=None, status=None, tags=None,
              bookmarked_by=None, assigned_to=None, sort_by='date',
              date_filter='last_seen', date_from=None, date_to=None,
              cursor=None, limit=100):
        """
        The return value should be a CursorResult.

        The limit here is a soft input limit, which gets trimmed by the Cursor.
        This means the backend should query limit + 2 and return that within the
        CursorResult.
        """
        raise NotImplementedError

    def upgrade(self):
        pass
