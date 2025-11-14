from typing import int
from unittest.mock import patch

import pytest
from django.db import connections
from django.db.utils import OperationalError

from sentry.db.models.query import in_iexact
from sentry.models.commit import Commit
from sentry.models.organization import Organization
from sentry.models.userreport import UserReport
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import no_silo_test
from sentry.users.models.user import User
from sentry.utils.query import (
    InvalidQuerySetError,
    RangeQuerySetWrapper,
    RangeQuerySetWrapperWithProgressBar,
    RangeQuerySetWrapperWithProgressBarApprox,
    bulk_delete_objects,
)


class InIexactQueryTest(TestCase):
    def test_basic(self) -> None:
        self.create_organization(slug="SlugA")
        self.create_organization(slug="slugB")
        self.create_organization(slug="slugc")

        assert Organization.objects.filter(in_iexact("slug", ["sluga", "slugb"])).count() == 2
        assert Organization.objects.filter(in_iexact("slug", ["slugC"])).count() == 1
        assert Organization.objects.filter(in_iexact("slug", [])).count() == 0


@no_silo_test
class RangeQuerySetWrapperTest(TestCase):
    range_wrapper = RangeQuerySetWrapper

    def test_basic(self) -> None:
        total = 10

        for _ in range(total):
            self.create_user()

        qs = User.objects.all()

        assert len(list(self.range_wrapper(qs, step=2))) == total
        assert len(list(self.range_wrapper(qs, limit=5))) == 5

    def test_loop_and_delete(self) -> None:
        total = 10
        for _ in range(total):
            self.create_user()

        qs = User.objects.all()

        for user in self.range_wrapper(qs, step=2):
            user.delete()

        assert User.objects.all().count() == 0

    def test_empty(self) -> None:
        qs = User.objects.all()
        assert len(list(self.range_wrapper(qs, step=2))) == 0

    def test_order_by_non_unique_fails(self) -> None:
        qs = User.objects.all()
        with pytest.raises(InvalidQuerySetError):
            self.range_wrapper(qs, order_by="name")

        # Shouldn't error if the safety check is disabled
        self.range_wrapper(qs, order_by="name", override_unique_safety_check=True)

    def test_order_by_unique(self) -> None:
        self.create_user()
        qs = User.objects.all()
        self.range_wrapper(qs, order_by="username")
        assert len(list(self.range_wrapper(qs, order_by="username", step=2))) == 1

    def test_wrapper_over_values_list(self) -> None:
        self.create_user()
        qs = User.objects.all().values_list("id")
        assert list(qs) == list(self.range_wrapper(qs, result_value_getter=lambda r: r[0]))

    def test_retry_on_operational_error_success_after_failures(self) -> None:
        """Test that with query_timeout_retries=3, after 2 errors and 1 success it works."""
        total = 5
        for _ in range(total):
            self.create_user()

        qs = User.objects.all()
        batch_attempts: list[int] = []
        current_batch_count = 0
        original_getitem = type(qs).__getitem__

        def mock_getitem(self, slice_obj):
            nonlocal current_batch_count
            current_batch_count += 1
            if len(batch_attempts) == 0 and current_batch_count <= 2:
                raise OperationalError("canceling statement due to user request")
            if len(batch_attempts) == 0 and current_batch_count == 3:
                batch_attempts.append(current_batch_count)
            return original_getitem(self, slice_obj)

        with patch.object(type(qs), "__getitem__", mock_getitem):
            results = list(
                self.range_wrapper(qs, step=10, query_timeout_retries=3, retry_delay_seconds=0.01)
            )

        assert len(results) == total
        assert batch_attempts[0] == 3

    def test_retry_exhausted_raises_exception(self) -> None:
        """Test that after exhausting retries, the OperationalError is raised."""
        total = 5
        for _ in range(total):
            self.create_user()

        qs = User.objects.all()

        def always_fail(self, slice_obj):
            raise OperationalError("canceling statement due to user request")

        with patch.object(type(qs), "__getitem__", always_fail):
            with pytest.raises(OperationalError, match="canceling statement due to user request"):
                list(
                    self.range_wrapper(
                        qs, step=10, query_timeout_retries=3, retry_delay_seconds=0.01
                    )
                )

    def test_retry_does_not_catch_other_exceptions(self) -> None:
        """Test that non-OperationalError exceptions are not retried."""
        total = 5
        for _ in range(total):
            self.create_user()

        qs = User.objects.all()

        attempt_count = {"count": 0}

        def raise_value_error(self, slice_obj):
            attempt_count["count"] += 1
            raise ValueError("Some other error")

        with patch.object(type(qs), "__getitem__", raise_value_error):
            with pytest.raises(ValueError, match="Some other error"):
                list(
                    self.range_wrapper(
                        qs, step=10, query_timeout_retries=3, retry_delay_seconds=0.01
                    )
                )
        assert attempt_count["count"] == 1

    def test_no_retry_when_query_timeout_retries_is_none(self) -> None:
        """Test that when query_timeout_retries is None, no retry logic is applied."""
        total = 5
        for _ in range(total):
            self.create_user()

        qs = User.objects.all()

        attempt_count = {"count": 0}

        def fail_once(self, slice_obj):
            attempt_count["count"] += 1
            raise OperationalError("canceling statement due to user request")

        with patch.object(type(qs), "__getitem__", fail_once):
            with pytest.raises(OperationalError, match="canceling statement due to user request"):
                list(self.range_wrapper(qs, step=10, query_timeout_retries=None))

        assert attempt_count["count"] == 1


@no_silo_test
class RangeQuerySetWrapperWithProgressBarTest(RangeQuerySetWrapperTest):
    range_wrapper = RangeQuerySetWrapperWithProgressBar


@no_silo_test
class RangeQuerySetWrapperWithProgressBarApproxTest(RangeQuerySetWrapperTest):
    range_wrapper = RangeQuerySetWrapperWithProgressBarApprox


class BulkDeleteObjectsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        UserReport.objects.all().delete()

    def test_basic(self) -> None:
        total = 10
        records = []
        for i in range(total):
            records.append(self.create_userreport(project=self.project, event_id=str(i) * 32))

        result = bulk_delete_objects(UserReport, id__in=[r.id for r in records])
        assert result, "Could be more work to do"
        assert len(UserReport.objects.all()) == 0
        assert bulk_delete_objects(UserReport) is False

    def test_basic_tuple(self) -> None:
        total = 10
        records = []
        for i in range(total):
            records.append(self.create_userreport(project=self.project, event_id=str(i) * 32))

        result = bulk_delete_objects(UserReport, id__in=tuple([r.id for r in records]))
        assert result, "Could be more work to do"
        assert len(UserReport.objects.all()) == 0

    def test_basic_set(self) -> None:
        total = 10
        records = []
        for i in range(total):
            records.append(self.create_userreport(project=self.project, event_id=str(i) * 32))

        result = bulk_delete_objects(UserReport, id__in={r.id for r in records})
        assert result, "Could be more work to do"
        assert len(UserReport.objects.all()) == 0

    def test_limiting(self) -> None:
        total = 10
        records = []
        for i in range(total):
            records.append(self.create_userreport(project=self.project, event_id=str(i) * 32))

        result = bulk_delete_objects(UserReport, id__in=[r.id for r in records], limit=5)
        assert result, "Still more work to do"
        assert len(UserReport.objects.all()) == 5

    def test_bulk_delete_single_query(self) -> None:
        repo = self.create_repo()
        # Commit is chosen because there are foreign keys and a naive delete
        # will attempt to cascade
        Commit.objects.create(organization_id=repo.organization_id, repository_id=repo.id)

        assert len(Commit.objects.all()) == 1
        before = len(connections[Commit.objects.db].queries_log)
        assert bulk_delete_objects(Commit)
        after = len(connections[Commit.objects.db].queries_log)
        assert after == before + 1
        assert len(Commit.objects.all()) == 0

    def test_bulk_delete_empty_queryset(self) -> None:
        assert bulk_delete_objects(UserReport, id__in=()) is False
