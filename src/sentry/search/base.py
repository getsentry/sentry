"""
sentry.search.base
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.utils.services import Service

ANY = object()
EMPTY = object()


class SearchBackend(Service):
    __all__ = ('query', 'validate')

    def __init__(self, **options):
        pass

    def query(
        self,
        project,
        query=None,
        status=None,
        tags=None,
        bookmarked_by=None,
        assigned_to=None,
        first_release=None,
        sort_by='date',
        age_from=None,
        age_to=None,
        unassigned=None,
        date_from=None,
        date_to=None,
        cursor=None,
        limit=100
    ):
        """
        The return value should be a CursorResult.

        The limit here is a soft input limit, which gets trimmed by the Cursor.
        This means the backend should query limit + 2 and return that within the
        CursorResult.
        """
        raise NotImplementedError
