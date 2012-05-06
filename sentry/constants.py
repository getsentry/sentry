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
    'priority': 'score',
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
