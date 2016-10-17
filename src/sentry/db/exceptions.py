"""
sentry.db.exceptions
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import


class QueryError(Exception):
    pass


class CannotResolveExpression(Exception):
    pass
