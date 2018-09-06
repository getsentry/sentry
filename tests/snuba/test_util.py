from __future__ import absolute_import

from datetime import datetime, timedelta

from sentry.testutils import TestCase
from sentry.utils import snuba


class SnubaUtilTest(TestCase):
    def test_referenced_columns(self):
        # a = 1 AND b = 1
        conditions = [
            ['a', '=', '1'],
            ['b', '=', '1'],
        ]
        assert set(snuba.all_referenced_columns(conditions)) == set(['a', 'b'])

        # a = 1 AND (b = 1 OR c = 1)
        conditions = [
            ['a', '=', '1'],
            [
                ['b', '=', '1'],
                ['c', '=', '1'],
            ],
        ]
        assert set(snuba.all_referenced_columns(conditions)) == set(['a', 'b', 'c'])

        # a = 1 AND (b = 1 OR foo(c) = 1)
        conditions = [
            ['a', '=', '1'],
            [
                ['b', '=', '1'],
                [['foo', ['c']], '=', '1'],
            ],
        ]
        assert set(snuba.all_referenced_columns(conditions)) == set(['a', 'b', 'c'])

        # a = 1 AND (b = 1 OR foo(c, bar(d)) = 1)
        conditions = [
            ['a', '=', '1'],
            [
                ['b', '=', '1'],
                [['foo', ['c', ['bar', ['d']]]], '=', '1'],
            ],
        ]
        assert set(snuba.all_referenced_columns(conditions)) == set(['a', 'b', 'c', 'd'])

    def test_shrink_timeframe(self):
        now = datetime.now()
        year_ago = now - timedelta(days=365)
        year_ahead = now + timedelta(days=365)

        issues = None
        assert snuba.shrink_time_window(issues, year_ago, year_ahead) == (year_ago, year_ahead)

        issues = []
        assert snuba.shrink_time_window(issues, year_ago, year_ahead) == (year_ago, year_ahead)

        group1 = self.create_group()
        group1.first_seen = now - timedelta(hours=1)
        group1.last_seen = now
        group1.save()
        group2 = self.create_group()

        # issues is a list like [(gid, pid, [(hash, tombstone_date), ...]), ...]
        issues = [(group1.id, group1.project_id, [('a' * 32, None)])]
        assert snuba.shrink_time_window(issues, year_ago, year_ahead) == \
            (now - timedelta(hours=1, minutes=5), now + timedelta(minutes=5))

        issues = [
            (group1.id, group1.project_id, [('a' * 32, None)]),
            (group2.id, group2.project_id, [('b' * 32, None)]),
        ]
        assert snuba.shrink_time_window(issues, year_ago, year_ahead) == (year_ago, year_ahead)
