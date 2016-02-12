from __future__ import absolute_import

import pytest

from sentry.api.paginator import (
    DateTimePaginator, OffsetPaginator
)
from sentry.models import User
from sentry.testutils import TestCase


class OffsetPaginatorTest(TestCase):
    # offset paginator does not support dynamic limits on is_prev
    def test_simple(self):
        res1 = self.create_user('foo@example.com')
        res2 = self.create_user('bar@example.com')
        res3 = self.create_user('baz@example.com')

        queryset = User.objects.all()

        paginator = OffsetPaginator(queryset, 'id')
        result1 = paginator.get_result(limit=1, cursor=None)
        assert len(result1) == 1, result1
        assert result1[0] == res1
        assert result1.next
        assert not result1.prev

        result2 = paginator.get_result(limit=1, cursor=result1.next)
        assert len(result2) == 1, (result2, list(result2))
        assert result2[0] == res2
        assert result2.next
        assert result2.prev

        result3 = paginator.get_result(limit=1, cursor=result2.next)
        assert len(result3) == 1, result3
        assert result3[0] == res3
        assert not result3.next
        assert result3.prev

        result4 = paginator.get_result(limit=1, cursor=result3.next)
        assert len(result4) == 0, result4
        assert not result4.next
        assert result4.prev

        result5 = paginator.get_result(limit=1, cursor=result4.prev)
        assert len(result5) == 1, result5
        assert result5[0] == res3
        assert not result5.next
        assert result5.prev


class DateTimePaginatorTest(TestCase):
    @pytest.mark.xfail
    def test_simple(self):
        res1 = self.create_user('foo@example.com')
        res2 = self.create_user('bar@example.com')
        res3 = self.create_user('baz@example.com')

        queryset = User.objects.all()

        paginator = DateTimePaginator(queryset, 'date_joined')
        result1 = paginator.get_result(limit=1, cursor=None)
        assert len(result1) == 1, result1
        assert result1[0] == res1
        assert result1.next
        assert not result1.prev

        result2 = paginator.get_result(limit=2, cursor=result1.next)
        assert len(result2) == 2, result2
        assert result2[0] == res2
        assert result2[1] == res3
        assert not result2.next
        assert result2.prev

        # this is not yet correct
        result3 = paginator.get_result(limit=2, cursor=result2.prev)
        assert len(result3) == 1, list(result3)
        assert result3[0] == res1
        assert result3.next
        assert not result3.prev
