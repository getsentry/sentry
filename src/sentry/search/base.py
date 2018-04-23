"""
sentry.search.base
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.utils.services import Service

ANY = object()


class SearchBackend(Service):
    __read_methods__ = frozenset(['query'])
    __write_methods__ = frozenset()
    __all__ = __read_methods__ | __write_methods__

    def __init__(self, **options):
        pass

    def query(self, project, tags=None, environment=None, sort_by='date', limit=100,
              cursor=None, count_hits=False, paginator_options=None, **parameters):
        raise NotImplementedError
