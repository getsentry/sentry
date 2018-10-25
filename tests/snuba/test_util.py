from __future__ import absolute_import

import pytest
from datetime import datetime, timedelta

from sentry.models import GroupHash
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
        GroupHash.objects.create(project_id=group1.project_id, group=group1, hash='a' * 32)

        group2 = self.create_group()
        GroupHash.objects.create(project_id=group2.project_id, group=group2, hash='b' * 32)

        issues = [group1.id]
        assert snuba.shrink_time_window(issues, year_ago, year_ahead) == \
            (now - timedelta(hours=1, minutes=5), now + timedelta(minutes=5))

        issues = [group1.id, group2.id]
        assert snuba.shrink_time_window(issues, year_ago, year_ahead) == (year_ago, year_ahead)

        with pytest.raises(snuba.QueryOutsideGroupActivityError):
            # query a group for a time range before it had any activity
            snuba.raw_query(
                start=group1.first_seen - timedelta(days=1, hours=1),
                end=group1.first_seen - timedelta(days=1),
                filter_keys={
                    'project_id': [group1.project_id],
                    'issue': [group1.id],
                },
                aggregations=[
                    ['count()', '', 'count'],
                ],
            )
