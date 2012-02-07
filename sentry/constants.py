from datetime import timedelta
from django.utils.datastructures import SortedDict
from django.utils.translation import ugettext_lazy as _

SORT_OPTIONS = SortedDict((
    ('priority', _('Priority')),
    ('date', _('Last Seen')),
    ('new', _('First Seen')),
    ('freq', _('Frequency')),
    ('tottime', _('Total Time Spent')),
    ('avgtime', _('Average Time Spent')),
    ('accel_15', _('Trending: %(minutes)d minutes' % {'minutes': 15})),
    ('accel_60', _('Trending: %(minutes)d minutes' % {'minutes': 60})),
))
SORT_CLAUSES = {
    'date': 'EXTRACT(EPOCH FROM last_seen)',
    'new': 'EXTRACT(EPOCH FROM first_seen)',
    'freq': 'times_seen',
    'tottime': 'time_spent_total',
    'avgtime': '(time_spent_total / time_spent_count)',
}
SQLITE_SORT_CLAUSES = SORT_CLAUSES.copy()
SQLITE_SORT_CLAUSES.update({
    'date': 'last_seen',
    'new': 'first_seen',
})
MYSQL_SORT_CLAUSES = SORT_CLAUSES.copy()
MYSQL_SORT_CLAUSES.update({
    'date': 'UNIX_TIMESTAMP(last_seen)',
    'new': 'UNIX_TIMESTAMP(first_seen)',
})
SEARCH_SORT_OPTIONS = SortedDict((
    ('score', _('Score')),
    ('date', _('Last Seen')),
    ('new', _('First Seen')),
))
DATE_OPTIONS = SortedDict((
    ('', _('All time')),
    ('30d', _('30 days')),
    ('7d', _('7 days')),
    ('3d', _('3 days')),
    ('1d', _('24 hours')),
))
DATE_VALUES = {
    '30d': timedelta(days=30),
    '7d': timedelta(days=7),
    '3d': timedelta(days=3),
    '1d': timedelta(days=1),
}
