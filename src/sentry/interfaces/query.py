"""
sentry.interfaces.query
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Query',)

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.utils.safe import trim


class Query(Interface):
    """
    A SQL query with an optional string describing the SQL driver, ``engine``.

    >>> {
    >>>     "query": "SELECT 1"
    >>>     "engine": "psycopg2"
    >>> }
    """
    @classmethod
    def to_python(cls, data):
        if not data.get('query'):
            raise InterfaceValidationError("No 'query' value")

        kwargs = {
            'query': trim(data['query'], 1024),
            'engine': trim(data.get('engine'), 128),
        }
        return cls(**kwargs)

    def get_hash(self):
        return [self.query]

    def get_path(self):
        return 'sentry.interfaces.Query'
