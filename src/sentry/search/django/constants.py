"""
sentry.search.django.constants
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

SORT_CLAUSES = {
    'priority': 'sentry_groupedmessage.score',
    'date': 'EXTRACT(EPOCH FROM sentry_groupedmessage.last_seen)::int',
    'new': 'EXTRACT(EPOCH FROM sentry_groupedmessage.first_seen)::int',
    'freq': 'sentry_groupedmessage.times_seen',
}

SQLITE_SORT_CLAUSES = SORT_CLAUSES.copy()
SQLITE_SORT_CLAUSES.update(
    {
        'date':
        "cast((julianday(sentry_groupedmessage.last_seen) - 2440587.5) * 86400.0 as INTEGER)",
        'new':
        "cast((julianday(sentry_groupedmessage.first_seen) - 2440587.5) * 86400.0 as INTEGER)",
    }
)
