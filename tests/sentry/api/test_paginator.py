from datetime import UTC, datetime, timedelta
from unittest import TestCase as SimpleTestCase

import pytest
from django.db.models import DateTimeField, IntegerField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Limit,
    Offset,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry.api.paginator import (
    BadPaginationError,
    CallbackPaginator,
    ChainPaginator,
    CombinedQuerysetIntermediary,
    CombinedQuerysetPaginator,
    DateTimePaginator,
    GenericOffsetPaginator,
    OffsetPaginator,
    Paginator,
    SequencePaginator,
    reverse_bisect_left,
)
from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.models.incident import Incident
from sentry.models.rule import Rule
from sentry.testutils.cases import APITestCase, SnubaTestCase, TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user import User
from sentry.utils.cursors import Cursor
from sentry.utils.snuba import raw_snql_query


@control_silo_test
class PaginatorTest(TestCase):
    cls = Paginator

    def test_max_limit(self):
        self.create_user("foo@example.com")
        self.create_user("bar@example.com")
        self.create_user("baz@example.com")

        queryset = User.objects.all()

        paginator = self.cls(queryset, "id", max_limit=10)
        result = paginator.get_result(limit=2, cursor=None)
        assert len(result) == 2

        paginator = self.cls(queryset, "id", max_limit=1)
        result = paginator.get_result(limit=2, cursor=None)
        assert len(result) == 1

    def test_count_hits(self):
        self.create_user("foo@example.com")
        self.create_user("bar@example.com")

        queryset = User.objects.filter(email="foo@example.com")
        paginator = self.cls(queryset, "id")
        result = paginator.count_hits(1000)
        assert result == 1

        queryset = User.objects.all()
        paginator = self.cls(queryset, "id")
        result = paginator.count_hits(1000)
        assert result == 2

        queryset = User.objects.none()
        paginator = self.cls(queryset, "id")
        result = paginator.count_hits(1000)
        assert result == 0

        queryset = User.objects.all()
        paginator = self.cls(queryset, "id")
        result = paginator.count_hits(1)
        assert result == 1

    def test_prev_emptyset(self):
        queryset = User.objects.all()

        paginator = self.cls(queryset, "id")
        result1 = paginator.get_result(limit=1, cursor=None)

        res1 = self.create_user("foo@example.com")

        result2 = paginator.get_result(limit=1, cursor=result1.prev)
        assert len(result2) == 1, (result2, list(result2))
        assert result2[0] == res1

        result3 = paginator.get_result(limit=1, cursor=result2.prev)
        assert len(result3) == 0, (result3, list(result3))


@control_silo_test
class OffsetPaginatorTest(TestCase):
    # offset paginator does not support dynamic limits on is_prev
    def test_simple(self):
        res1 = self.create_user("foo@example.com")
        res2 = self.create_user("bar@example.com")
        res3 = self.create_user("baz@example.com")

        queryset = User.objects.all()

        paginator = OffsetPaginator(queryset, "id")
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

    def test_negative_offset(self):
        self.create_user("baz@example.com")
        queryset = User.objects.all()
        paginator = OffsetPaginator(queryset)
        cursor = Cursor(10, -1)
        with pytest.raises(BadPaginationError):
            paginator.get_result(cursor=cursor)

        cursor = Cursor(-10, 1)
        with pytest.raises(BadPaginationError):
            paginator.get_result(cursor=cursor)

    def test_order_by_multiple(self):
        res1 = self.create_user("foo@example.com")
        self.create_user("bar@example.com")
        res3 = self.create_user("baz@example.com")

        queryset = User.objects.all()

        paginator = OffsetPaginator(queryset, "id")
        result = paginator.get_result(limit=1, cursor=None)
        assert len(result) == 1, result
        assert result[0] == res1
        assert result.next
        assert not result.prev

        res3.update(is_active=False)

        paginator = OffsetPaginator(queryset, ("is_active", "id"))
        result = paginator.get_result(limit=1, cursor=None)
        assert len(result) == 1, result
        assert result[0] == res3
        assert result.next
        assert not result.prev

        result = paginator.get_result(limit=1, cursor=result.next)
        assert len(result) == 1, (result, list(result))
        assert result[0] == res1
        assert result.next
        assert result.prev

    def test_max_offset(self):
        self.create_user("foo@example.com")
        self.create_user("bar@example.com")
        self.create_user("baz@example.com")

        queryset = User.objects.all()

        paginator = OffsetPaginator(queryset, max_offset=10)
        result1 = paginator.get_result(cursor=None)
        assert len(result1) == 3, result1

        paginator = OffsetPaginator(queryset, max_offset=0)
        with pytest.raises(BadPaginationError):
            paginator.get_result()


@control_silo_test
class DateTimePaginatorTest(TestCase):
    def test_ascending(self):
        joined = timezone.now()

        # The DateTime pager only has accuracy up to 1000th of a second.
        # Everything can't be added within less than 10 microseconds of each
        # other. This is handled by the pager (see test_rounding_offset), but
        # this case shouldn't rely on it.
        res1 = self.create_user("foo@example.com", date_joined=joined)
        res2 = self.create_user("bar@example.com", date_joined=joined + timedelta(seconds=1))
        res3 = self.create_user("baz@example.com", date_joined=joined + timedelta(seconds=2))
        res4 = self.create_user("qux@example.com", date_joined=joined + timedelta(seconds=3))

        queryset = User.objects.all()

        paginator = DateTimePaginator(queryset, "date_joined")
        result1 = paginator.get_result(limit=2, cursor=None)
        assert len(result1) == 2, result1
        assert result1[0] == res1
        assert result1[1] == res2
        assert result1.next
        assert not result1.prev

        result2 = paginator.get_result(limit=2, cursor=result1.next)
        assert len(result2) == 2, result2
        assert result2[0] == res3
        assert result2[1] == res4
        assert not result2.next
        assert result2.prev

        result3 = paginator.get_result(limit=1, cursor=result2.prev)
        assert len(result3) == 1, result3
        assert result3[0] == res2
        assert result3.next
        assert result3.prev

        result4 = paginator.get_result(limit=1, cursor=result3.prev)
        assert len(result4) == 1, result4
        assert result4[0] == res1
        assert result4.next
        assert not result4.prev

    def test_descending(self):
        joined = timezone.now()

        res1 = self.create_user("foo@example.com", date_joined=joined)
        res2 = self.create_user("bar@example.com", date_joined=joined + timedelta(seconds=1))
        res3 = self.create_user("baz@example.com", date_joined=joined + timedelta(seconds=2))

        queryset = User.objects.all()

        paginator = DateTimePaginator(queryset, "-date_joined")
        result1 = paginator.get_result(limit=1, cursor=None)
        assert len(result1) == 1, result1
        assert result1[0] == res3
        assert result1.next
        assert not result1.prev

        result2 = paginator.get_result(limit=2, cursor=result1.next)
        assert len(result2) == 2, result2
        assert result2[0] == res2
        assert result2[1] == res1
        assert not result2.next
        assert result2.prev

        result3 = paginator.get_result(limit=2, cursor=result2.prev)
        assert len(result3) == 1, result3
        assert result3[0] == res3
        assert result3.next
        assert not result3.prev

    def test_prev_descending_with_new(self):
        joined = timezone.now()

        res1 = self.create_user("foo@example.com", date_joined=joined)
        res2 = self.create_user("bar@example.com", date_joined=joined + timedelta(seconds=1))

        queryset = User.objects.all()

        paginator = DateTimePaginator(queryset, "-date_joined")
        result1 = paginator.get_result(limit=10, cursor=None)
        assert len(result1) == 2, result1
        assert result1[0] == res2
        assert result1[1] == res1

        res3 = self.create_user("baz@example.com", date_joined=joined + timedelta(seconds=2))
        res4 = self.create_user("qux@example.com", date_joined=joined + timedelta(seconds=3))

        result2 = paginator.get_result(limit=10, cursor=result1.prev)
        assert len(result2) == 2, result2
        assert result2[0] == res4
        assert result2[1] == res3

        result3 = paginator.get_result(limit=10, cursor=result2.prev)
        assert len(result3) == 0, result3

        result4 = paginator.get_result(limit=10, cursor=result1.next)
        assert len(result4) == 0, result4

    def test_rounding_offset(self):
        joined = timezone.now()

        res1 = self.create_user("foo@example.com", date_joined=joined)
        res2 = self.create_user("bar@example.com", date_joined=joined + timedelta(microseconds=1))
        res3 = self.create_user("baz@example.com", date_joined=joined + timedelta(microseconds=2))
        res4 = self.create_user("qux@example.com", date_joined=joined + timedelta(microseconds=3))

        queryset = User.objects.all()

        paginator = DateTimePaginator(queryset, "date_joined")
        result1 = paginator.get_result(limit=3, cursor=None)
        assert len(result1) == 3, result1
        assert result1[0] == res1
        assert result1[1] == res2
        assert result1[2] == res3

        result2 = paginator.get_result(limit=10, cursor=result1.next)
        assert len(result2) == 1, result2
        assert result2[0] == res4

        result3 = paginator.get_result(limit=2, cursor=result2.prev)
        assert len(result3) == 2, result3
        assert result3[0] == res2
        assert result3[1] == res3

        result4 = paginator.get_result(limit=1, cursor=result3.prev)
        assert len(result4) == 1, result4
        assert result4[0] == res1

        result5 = paginator.get_result(limit=10, cursor=result4.prev)
        assert len(result5) == 0, list(result5)

    def test_same_row_updated(self):
        joined = timezone.now()
        res1 = self.create_user("foo@example.com", date_joined=joined)
        queryset = User.objects.all()

        paginator = DateTimePaginator(queryset, "-date_joined")
        result1 = paginator.get_result(limit=3, cursor=None)
        assert len(result1) == 1, result1
        assert result1[0] == res1

        # Prev page should return no results
        result2 = paginator.get_result(limit=3, cursor=result1.prev)
        assert len(result2) == 0, result2

        # If the same row has an updated join date then it should
        # show up on the prev page
        res1.update(date_joined=joined + timedelta(seconds=1))
        result3 = paginator.get_result(limit=3, cursor=result1.prev)
        assert len(result3) == 1, result3
        assert result3[0] == res1

        # Make sure updates work as expected with extra rows
        res1.update(date_joined=res1.date_joined + timedelta(seconds=1))
        res2 = self.create_user(
            "bar@example.com", date_joined=res1.date_joined + timedelta(seconds=1)
        )
        res3 = self.create_user(
            "baz@example.com", date_joined=res1.date_joined + timedelta(seconds=2)
        )
        res4 = self.create_user(
            "bat@example.com", date_joined=res1.date_joined + timedelta(seconds=3)
        )
        result4 = paginator.get_result(limit=1, cursor=result3.prev)
        assert len(result4) == 1, result4
        assert result4[0] == res1

        result5 = paginator.get_result(limit=3, cursor=result3.prev)
        assert len(result5) == 3, result5
        assert result5[0] == res3
        assert result5[1] == res2
        assert result5[2] == res1

        result6 = paginator.get_result(limit=3, cursor=result5.prev)
        assert len(result6) == 1, result6
        assert result6[0] == res4

        res4.update(date_joined=res4.date_joined + timedelta(seconds=1))
        result7 = paginator.get_result(limit=3, cursor=result6.prev)
        assert len(result7) == 1, result7
        assert result7[0] == res4


def test_reverse_bisect_left():
    assert reverse_bisect_left([], 0) == 0

    assert reverse_bisect_left([1], -1) == 1
    assert reverse_bisect_left([1], 0) == 1
    assert reverse_bisect_left([1], 1) == 0
    assert reverse_bisect_left([1], 2) == 0

    assert reverse_bisect_left([2, 1], -1) == 2
    assert reverse_bisect_left([2, 1], 0) == 2
    assert reverse_bisect_left([2, 1], 1) == 1
    assert reverse_bisect_left([2, 1], 2) == 0
    assert reverse_bisect_left([2, 1], 3) == 0

    assert reverse_bisect_left([3, 2, 1], -1) == 3
    assert reverse_bisect_left([3, 2, 1], 0) == 3
    assert reverse_bisect_left([3, 2, 1], 1) == 2
    assert reverse_bisect_left([3, 2, 1], 2) == 1
    assert reverse_bisect_left([3, 2, 1], 3) == 0
    assert reverse_bisect_left([3, 2, 1], 4) == 0

    assert reverse_bisect_left([4, 3, 2, 1], -1) == 4
    assert reverse_bisect_left([4, 3, 2, 1], 0) == 4
    assert reverse_bisect_left([4, 3, 2, 1], 1) == 3
    assert reverse_bisect_left([4, 3, 2, 1], 2) == 2
    assert reverse_bisect_left([4, 3, 2, 1], 3) == 1
    assert reverse_bisect_left([4, 3, 2, 1], 4) == 0
    assert reverse_bisect_left([4, 3, 2, 1], 5) == 0

    assert reverse_bisect_left([1, 1], 0) == 2
    assert reverse_bisect_left([1, 1], 1) == 0
    assert reverse_bisect_left([1, 1], 2) == 0

    assert reverse_bisect_left([2, 1, 1], 0) == 3
    assert reverse_bisect_left([2, 1, 1], 1) == 1
    assert reverse_bisect_left([2, 1, 1], 2) == 0

    assert reverse_bisect_left([2, 2, 1], 0) == 3
    assert reverse_bisect_left([2, 2, 1], 1) == 2
    assert reverse_bisect_left([2, 2, 1], 2) == 0

    assert reverse_bisect_left([3, 2, 1], 2, hi=10) == 1


class SequencePaginatorTestCase(SimpleTestCase):
    def test_empty_results(self):
        paginator: SequencePaginator[None] = SequencePaginator([])
        result = paginator.get_result(5)
        assert list(result) == []
        assert result.prev == Cursor(0, 0, True, False)
        assert result.next == Cursor(0, 0, False, False)

        paginator = SequencePaginator([], reverse=True)
        result = paginator.get_result(5)
        assert list(result) == []
        assert result.prev == Cursor(0, 0, True, False)
        assert result.next == Cursor(0, 0, False, False)

    def test_ascending_simple(self):
        paginator = SequencePaginator([(i, i) for i in range(10)], reverse=False)

        result = paginator.get_result(5)
        assert list(result) == [0, 1, 2, 3, 4]
        assert result.prev == Cursor(0, 0, True, False)
        assert result.next == Cursor(5, 0, False, True)

        result = paginator.get_result(5, result.next)
        assert list(result) == [5, 6, 7, 8, 9]
        assert result.prev == Cursor(5, 0, True, True)
        assert result.next == Cursor(9, 1, False, False)

        result = paginator.get_result(5, result.prev)
        assert list(result) == [0, 1, 2, 3, 4]
        assert result.prev == Cursor(0, 0, True, False)
        assert result.next == Cursor(5, 0, False, True)

        result = paginator.get_result(5, Cursor(100, 0, False))
        assert list(result) == []
        assert result.prev == Cursor(9, 1, True, True)
        assert result.next == Cursor(9, 1, False, False)

    def test_descending_simple(self):
        paginator = SequencePaginator([(i, i) for i in range(10)], reverse=True)

        result = paginator.get_result(5)
        assert list(result) == [9, 8, 7, 6, 5]
        assert result.prev == Cursor(9, 0, True, False)
        assert result.next == Cursor(4, 0, False, True)

        result = paginator.get_result(5, result.next)
        assert list(result) == [4, 3, 2, 1, 0]
        assert result.prev == Cursor(4, 0, True, True)
        assert result.next == Cursor(0, 1, False, False)

        result = paginator.get_result(5, result.prev)
        assert list(result) == [9, 8, 7, 6, 5]
        assert result.prev == Cursor(9, 0, True, False)
        assert result.next == Cursor(4, 0, False, True)

        result = paginator.get_result(5, Cursor(-10, 0, False))
        assert list(result) == []
        assert result.prev == Cursor(0, 1, True, True)
        assert result.next == Cursor(0, 1, False, False)

    def test_ascending_repeated_scores(self):
        paginator = SequencePaginator([(1, i) for i in range(10)], reverse=False)

        result = paginator.get_result(5)
        assert list(result) == [0, 1, 2, 3, 4]
        assert result.prev == Cursor(1, 0, True, False)
        assert result.next == Cursor(1, 5, False, True)

        result = paginator.get_result(5, result.next)
        assert list(result) == [5, 6, 7, 8, 9]
        assert result.prev == Cursor(1, 5, True, True)
        assert result.next == Cursor(1, 10, False, False)

        result = paginator.get_result(5, result.prev)
        assert list(result) == [0, 1, 2, 3, 4]
        assert result.prev == Cursor(1, 0, True, False)
        assert result.next == Cursor(1, 5, False, True)

        result = paginator.get_result(5, Cursor(100, 0, False))
        assert list(result) == []
        assert result.prev == Cursor(1, 10, True, True)
        assert result.next == Cursor(1, 10, False, False)

    def test_descending_repeated_scores(self):
        paginator = SequencePaginator([(1, i) for i in range(10)], reverse=True)

        result = paginator.get_result(5)
        assert list(result) == [9, 8, 7, 6, 5]
        assert result.prev == Cursor(1, 0, True, False)
        assert result.next == Cursor(1, 5, False, True)

        result = paginator.get_result(5, result.next)
        assert list(result) == [4, 3, 2, 1, 0]
        assert result.prev == Cursor(1, 5, True, True)
        assert result.next == Cursor(1, 10, False, False)

        result = paginator.get_result(5, result.prev)
        assert list(result) == [9, 8, 7, 6, 5]
        assert result.prev == Cursor(1, 0, True, False)
        assert result.next == Cursor(1, 5, False, True)

        result = paginator.get_result(5, Cursor(-10, 0, False))
        assert list(result) == []
        assert result.prev == Cursor(1, 10, True, True)
        assert result.next == Cursor(1, 10, False, False)

    def test_hits(self):
        n = 10
        paginator = SequencePaginator([(i, i) for i in range(n)])
        assert paginator.get_result(5, count_hits=True).hits == n


class GenericOffsetPaginatorTest(SimpleTestCase):
    def test_simple(self):
        def data_fn(offset=None, limit=None):
            return [i for i in range(offset, limit)]

        paginator = GenericOffsetPaginator(data_fn=data_fn)

        result = paginator.get_result(5)

        assert list(result) == [0, 1, 2, 3, 4]
        assert result.prev == Cursor(0, 0, True, False)
        assert result.next == Cursor(0, 5, False, True)

        result2 = paginator.get_result(5, result.next)

        assert list(result2) == [5]
        assert result2.prev == Cursor(0, 0, True, True)
        assert result2.next == Cursor(0, 10, False, False)


class CombinedQuerysetPaginatorTest(APITestCase):
    def test_simple(self):
        project = self.project
        Rule.objects.all().delete()

        alert_rule0 = self.create_alert_rule(name="alertrule0")
        alert_rule1 = self.create_alert_rule(name="alertrule1")
        rule1 = Rule.objects.create(label="rule1", project=project)
        alert_rule2 = self.create_alert_rule(name="alertrule2")
        alert_rule3 = self.create_alert_rule(name="alertrule3")
        rule2 = Rule.objects.create(label="rule2", project=project)
        rule3 = Rule.objects.create(label="rule3", project=project)

        alert_rule_intermediary = CombinedQuerysetIntermediary(
            AlertRule.objects.all(), ["date_added"]
        )
        rule_intermediary = CombinedQuerysetIntermediary(Rule.objects.all(), ["date_added"])
        paginator = CombinedQuerysetPaginator(
            intermediaries=[alert_rule_intermediary, rule_intermediary],
            desc=True,
        )

        result = paginator.get_result(limit=3, cursor=None)
        assert len(result) == 3
        page1_results = list(result)
        assert page1_results[0].id == rule3.id
        assert page1_results[1].id == rule2.id
        assert page1_results[2].id == alert_rule3.id

        next_cursor = result.next
        result = paginator.get_result(limit=3, cursor=next_cursor)
        page2_results = list(result)
        assert len(result) == 3
        assert page2_results[0].id == alert_rule2.id
        assert page2_results[1].id == rule1.id
        assert page2_results[2].id == alert_rule1.id

        next_cursor = result.next
        prev_cursor = result.prev
        result = paginator.get_result(limit=3, cursor=next_cursor)
        page3_results = list(result)
        assert len(result) == 1
        assert page3_results[0].id == alert_rule0.id

        result = paginator.get_result(limit=3, cursor=prev_cursor)
        assert list(result) == page1_results

        # Test reverse sorting:
        paginator = CombinedQuerysetPaginator(
            intermediaries=[alert_rule_intermediary, rule_intermediary],
        )
        result = paginator.get_result(limit=3, cursor=None)
        assert len(result) == 3
        page1_results = list(result)
        assert page1_results[0].id == alert_rule0.id
        assert page1_results[1].id == alert_rule1.id
        assert page1_results[2].id == rule1.id

        next_cursor = result.next
        result = paginator.get_result(limit=3, cursor=next_cursor)
        page2_results = list(result)
        assert len(result) == 3
        assert page2_results[0].id == alert_rule2.id
        assert page2_results[1].id == alert_rule3.id
        assert page2_results[2].id == rule2.id

        next_cursor = result.next
        prev_cursor = result.prev
        result = paginator.get_result(limit=3, cursor=next_cursor)
        page3_results = list(result)
        assert len(result) == 1
        assert page3_results[0].id == rule3.id

        result = paginator.get_result(limit=3, cursor=prev_cursor)
        assert list(result) == page1_results

    def test_order_by_invalid_key(self):
        with pytest.raises(AssertionError):
            rule_intermediary = CombinedQuerysetIntermediary(Rule.objects.all(), "dontexist")
            CombinedQuerysetPaginator(
                intermediaries=[rule_intermediary],
            )

    def test_mix_date_and_not_date(self):
        with pytest.raises(AssertionError):
            rule_intermediary = CombinedQuerysetIntermediary(Rule.objects.all(), "date_added")
            rule_intermediary2 = CombinedQuerysetIntermediary(Rule.objects.all(), "label")
            CombinedQuerysetPaginator(
                intermediaries=[rule_intermediary, rule_intermediary2],
            )

    def test_only_issue_alert_rules(self):
        project = self.project
        Rule.objects.all().delete()
        rule_ids = []

        for i in range(1, 9):
            rule = Rule.objects.create(id=i, label=f"rule{i}", project=project)
            rule_ids.append(rule.id)

        rules = Rule.objects.all()
        far_past_date = Value(datetime.min.replace(tzinfo=UTC), output_field=DateTimeField())
        rules = rules.annotate(date_triggered=far_past_date)
        incident_status_value = Value(-2, output_field=IntegerField())
        rules = rules.annotate(incident_status=incident_status_value)

        alert_rule_intermediary = CombinedQuerysetIntermediary(
            AlertRule.objects.all(), ["incident_status", "date_triggered"]
        )
        rule_intermediary = CombinedQuerysetIntermediary(
            rules, ["incident_status", "date_triggered"]
        )
        paginator = CombinedQuerysetPaginator(
            intermediaries=[alert_rule_intermediary, rule_intermediary],
            desc=True,
        )

        result = paginator.get_result(limit=5, cursor=None)
        assert len(result) == 5
        page1_results = list(result)
        assert page1_results[0].id == rule_ids[0]
        assert page1_results[4].id == rule_ids[4]

        next_cursor = result.next
        result = paginator.get_result(limit=5, cursor=next_cursor)
        page2_results = list(result)
        assert len(result) == 3
        assert page2_results[-1].id == rule_ids[-1]

        prev_cursor = result.prev
        result = list(paginator.get_result(limit=5, cursor=prev_cursor))
        assert len(result) == 5
        assert result == page1_results

    def test_only_metric_alert_rules(self):
        project = self.project
        AlertRule.objects.all().delete()
        Rule.objects.all().delete()
        alert_rule_ids = []

        for i in range(1, 9):
            alert_rule = self.create_alert_rule(name=f"alertrule{i}", projects=[project])
            alert_rule_ids.append(alert_rule.id)

        rules = AlertRule.objects.all()
        far_past_date = Value(datetime.min.replace(tzinfo=UTC), output_field=DateTimeField())
        rules = rules.annotate(
            date_triggered=Coalesce(
                Subquery(
                    Incident.objects.filter(alert_rule=OuterRef("pk"))
                    .order_by("-date_started")
                    .values("date_started")[:1]
                ),
                far_past_date,
            ),
        )
        rules = rules.annotate(
            incident_status=Coalesce(
                Subquery(
                    Incident.objects.filter(alert_rule=OuterRef("pk"))
                    .order_by("-date_started")
                    .values("status")[:1]
                ),
                Value(-1, output_field=IntegerField()),
            )
        )

        alert_rule_intermediary = CombinedQuerysetIntermediary(
            rules, ["incident_status", "date_triggered"]
        )
        rule_intermediary = CombinedQuerysetIntermediary(
            Rule.objects.all(), ["incident_status", "date_triggered"]
        )
        paginator = CombinedQuerysetPaginator(
            intermediaries=[alert_rule_intermediary, rule_intermediary],
            desc=True,
        )

        result = paginator.get_result(limit=5, cursor=None)
        assert len(result) == 5
        page1_results = list(result)
        assert page1_results[0].id == alert_rule_ids[0]
        assert page1_results[4].id == alert_rule_ids[4]

        next_cursor = result.next
        result = paginator.get_result(limit=5, cursor=next_cursor)
        page2_results = list(result)
        assert len(result) == 3
        assert page2_results[-1].id == alert_rule_ids[-1]

        prev_cursor = result.prev
        result = list(paginator.get_result(limit=5, cursor=prev_cursor))
        assert len(result) == 5
        assert result == page1_results

    def test_issue_and_metric_alert_rules(self):
        project = self.project
        AlertRule.objects.all().delete()
        Rule.objects.all().delete()
        alert_rule_ids = []
        rule_ids = []

        for i in range(1, 4):
            alert_rule = self.create_alert_rule(name=f"alertrule{i}")
            alert_rule_ids.append(alert_rule.id)
            rule = Rule.objects.create(id=i, label=f"rule{i}", project=project)
            rule_ids.append(rule.id)

        metric_alert_rules = AlertRule.objects.all()
        issue_alert_rules = Rule.objects.all()

        far_past_date = Value(datetime.min.replace(tzinfo=UTC), output_field=DateTimeField())
        issue_alert_rules = issue_alert_rules.annotate(date_triggered=far_past_date)
        metric_alert_rules = metric_alert_rules.annotate(
            date_triggered=Coalesce(
                Subquery(
                    Incident.objects.filter(alert_rule=OuterRef("pk"))
                    .order_by("-date_started")
                    .values("date_started")[:1]
                ),
                far_past_date,
            ),
        )
        incident_status_value = Value(-2, output_field=IntegerField())
        issue_alert_rules = issue_alert_rules.annotate(incident_status=incident_status_value)
        metric_alert_rules = metric_alert_rules.annotate(
            incident_status=Coalesce(
                Subquery(
                    Incident.objects.filter(alert_rule=OuterRef("pk"))
                    .order_by("-date_started")
                    .values("status")[:1]
                ),
                Value(-1, output_field=IntegerField()),
            )
        )

        alert_rule_intermediary = CombinedQuerysetIntermediary(
            metric_alert_rules, ["incident_status", "date_triggered"]
        )
        rule_intermediary = CombinedQuerysetIntermediary(
            issue_alert_rules, ["incident_status", "date_triggered"]
        )
        paginator = CombinedQuerysetPaginator(
            intermediaries=[alert_rule_intermediary, rule_intermediary],
            desc=True,
        )

        result = paginator.get_result(limit=5, cursor=None)
        page1_results = list(result)
        assert len(result) == 5
        assert result[0].id == alert_rule_ids[0]
        assert result[4].id == rule_ids[1]

        next_cursor = result.next
        result = paginator.get_result(limit=5, cursor=next_cursor)
        page2_results = list(result)
        assert len(result) == 1
        assert page2_results[0].id == 3

        prev_cursor = result.prev
        result = list(paginator.get_result(limit=5, cursor=prev_cursor))
        assert len(result) == 5
        assert result == page1_results


class TestChainPaginator(SimpleTestCase):
    cls = ChainPaginator

    def test_simple(self):
        sources = [[1, 2, 3, 4], [5, 6, 7, 8]]
        paginator = self.cls(sources=sources)
        result = paginator.get_result(limit=5)
        assert len(result.results) == 5
        assert result.results == [1, 2, 3, 4, 5]
        assert result.next.has_results
        assert result.prev.has_results is False

    def test_small_first(self):
        sources = [[1, 2], [3, 4, 5, 6, 7, 8, 9, 10]]
        paginator = self.cls(sources=sources)
        first = paginator.get_result(limit=4)
        assert first.results == [1, 2, 3, 4]
        assert first.next.has_results
        assert not first.prev.has_results

        second = paginator.get_result(limit=4, cursor=first.next)
        assert second.results == [5, 6, 7, 8]
        assert second.prev.has_results
        assert second.next.has_results

    def test_results_from_two_sources(self):
        sources = [[1, 2, 3, 4], [5, 6, 7, 8]]
        cursor = Cursor(3, 1)
        paginator = self.cls(sources=sources)
        result = paginator.get_result(limit=3, cursor=cursor)
        assert len(result.results) == 3
        assert result.results == [4, 5, 6]
        assert result.next.has_results
        assert result.prev.has_results

    def test_results_from_last_source(self):
        sources = [[1, 2, 3, 4], [5, 6, 7, 8]]
        cursor = Cursor(3, 2)
        paginator = self.cls(sources=sources)
        result = paginator.get_result(limit=3, cursor=cursor)
        assert len(result.results) == 2
        assert result.results == [7, 8]
        assert result.next.has_results is False
        assert result.prev.has_results

    def test_no_duplicates_in_pagination(self):
        sources = [[1, 2, 3, 4], [5, 6, 7, 8]]
        cursor = Cursor(3, 0)
        paginator = self.cls(sources=sources)

        first = paginator.get_result(limit=3, cursor=cursor)
        assert len(first.results) == 3
        assert first.results == [1, 2, 3]
        assert first.next.has_results

        second = paginator.get_result(limit=3, cursor=first.next)
        assert len(second.results) == 3
        assert second.results == [4, 5, 6]
        assert second.next.has_results

        third = paginator.get_result(limit=3, cursor=second.next)
        assert len(third.results) == 2
        assert third.results == [7, 8]
        assert third.next.has_results is False


def dummy_snuba_request_method(limit, offset, org_id, proj_id, timestamp):
    referrer = "tests.sentry.api.test_paginator"
    query = Query(
        match=Entity("events"),
        select=[Column("event_id")],
        where=[
            Condition(Column("project_id"), Op.EQ, proj_id),
            Condition(Column("timestamp"), Op.GTE, timestamp - timedelta(days=1)),
            Condition(Column("timestamp"), Op.LT, timestamp + timedelta(days=1)),
        ],
        orderby=[OrderBy(Column("event_id"), Direction.ASC)],
        offset=Offset(offset),
        limit=Limit(limit),
    )
    request = Request(
        dataset="events",
        app_id=referrer,
        query=query,
        tenant_ids={"referrer": referrer, "organization_id": org_id},
    )
    return raw_snql_query(request, referrer)["data"]


class CallbackPaginatorTest(APITestCase, SnubaTestCase):
    cls = CallbackPaginator

    def setUp(self):
        super().setUp()
        self.now = timezone.now()
        self.project.date_added = self.now - timedelta(minutes=5)
        for i in range(8):
            self.store_event(
                project_id=self.project.id,
                data={
                    "event_id": str(i) * 32,
                    "timestamp": (self.now - timedelta(minutes=2)).isoformat(),
                },
            )

    def test_simple(self):
        paginator = self.cls(
            callback=lambda limit, offset: dummy_snuba_request_method(
                limit, offset, self.organization.id, self.project.id, self.now
            ),
        )
        first_page = paginator.get_result(limit=3)
        assert len(first_page.results) == 3
        assert first_page.results == [{"event_id": str(i) * 32} for i in range(3)]
        assert first_page.next.offset == 1
        assert first_page.next.has_results
        assert first_page.prev.has_results is False

        second_page = paginator.get_result(limit=3, cursor=first_page.next)
        assert len(second_page.results) == 3
        assert second_page.results == [{"event_id": str(i) * 32} for i in range(3, 6)]
        assert second_page.next.offset == 2
        assert second_page.next.has_results
        assert second_page.prev.offset == 0
        assert second_page.prev.has_results

        third_page = paginator.get_result(limit=3, cursor=second_page.next)
        assert len(third_page.results) == 2
        assert third_page.results == [{"event_id": str(i) * 32} for i in range(6, 8)]
        assert third_page.next.has_results is False
        assert third_page.prev.offset == 1
        assert third_page.prev.has_results
