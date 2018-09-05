from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.utils import snuba


class SnubaUtilTest(TestCase):
    def test_referenced_columns(self):
        # a = 1 AND b = 1
        conditions = [
            ['a', '=', '1'],
            ['b', '=', '1'],
        ]
        assert snuba.all_referenced_columns(conditions) == set(['a', 'b'])

        # a = 1 AND (b = 1 OR c = 1)
        conditions = [
            ['a', '=', '1'],
            [
                ['b', '=', '1'],
                ['c', '=', '1'],
            ],
        ]
        assert snuba.all_referenced_columns(conditions) == set(['a', 'b', 'c'])

        # a = 1 AND (b = 1 OR foo(c) = 1)
        conditions = [
            ['a', '=', '1'],
            [
                ['b', '=', '1'],
                [['foo', ['c']], '=', '1'],
            ],
        ]
        assert snuba.all_referenced_columns(conditions) == set(['a', 'b', 'c'])

        # a = 1 AND (b = 1 OR foo(c, bar(d)) = 1)
        conditions = [
            ['a', '=', '1'],
            [
                ['b', '=', '1'],
                [['foo', ['c', ['bar', ['d']]]], '=', '1'],
            ],
        ]
        assert snuba.all_referenced_columns(conditions) == set(['a', 'b', 'c', 'd'])
