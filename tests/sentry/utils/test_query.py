import pytest
from django.db import connections

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

    def test_descending_iteration(self) -> None:
        """Test iteration with negative step values (descending order)."""
        users = []
        for i in range(5):
            users.append(self.create_user(username=f"user_{i:02d}"))

        # Sort users by ID for comparison
        users.sort(key=lambda u: u.id)

        # Test descending iteration
        qs = User.objects.all()
        descending_results = list(self.range_wrapper(qs, step=-2))  # Negative step

        # Results should be in descending order by ID
        assert len(descending_results) == 5
        descending_ids = [u.id for u in descending_results]
        assert descending_ids == sorted(descending_ids, reverse=True)

    def test_descending_with_limit(self) -> None:
        """Test descending iteration with limit."""
        for i in range(10):
            self.create_user(username=f"user_{i:02d}")

        qs = User.objects.all()
        results = list(self.range_wrapper(qs, step=-3, limit=4))

        assert len(results) == 4
        # Should be in descending order
        ids = [u.id for u in results]
        assert ids == sorted(ids, reverse=True)

    def test_min_id_parameter(self) -> None:
        """Test starting iteration from a specific min_id."""
        users = []
        for i in range(10):
            users.append(self.create_user(username=f"user_{i:02d}"))

        users.sort(key=lambda u: u.id)  # Sort by ID
        middle_user_id = users[5].id  # Start from middle

        qs = User.objects.all()
        results = list(self.range_wrapper(qs, min_id=middle_user_id, step=2))

        # Should only get users with ID >= middle_user_id
        result_ids = [u.id for u in results]
        assert all(uid >= middle_user_id for uid in result_ids)
        assert len(results) == 5  # Should get last 5 users

    def test_min_id_with_descending(self) -> None:
        """Test min_id with descending iteration."""
        users = []
        for i in range(10):
            users.append(self.create_user(username=f"user_{i:02d}"))

        users.sort(key=lambda u: u.id)
        middle_user_id = users[5].id

        qs = User.objects.all()
        results = list(self.range_wrapper(qs, min_id=middle_user_id, step=-2))

        # Should get users with ID <= middle_user_id in descending order
        result_ids = [u.id for u in results]
        assert all(uid <= middle_user_id for uid in result_ids)
        assert result_ids == sorted(result_ids, reverse=True)

    def test_callbacks_functionality(self) -> None:
        """Test that callbacks are called correctly with batches."""
        for i in range(8):
            self.create_user(username=f"user_{i:02d}")

        callback_calls = []

        def batch_callback(batch):
            callback_calls.append(len(batch))

        def count_callback(batch):
            callback_calls.append(f"batch_count_{len(batch)}")

        qs = User.objects.all()
        results = list(self.range_wrapper(
            qs,
            step=3,  # Should create 3 batches: 3, 3, 2 items
            callbacks=[batch_callback, count_callback]
        ))

        assert len(results) == 8
        # Each callback should be called for each batch
        # We expect: batch_size, "batch_count_N", batch_size, "batch_count_N", etc.
        assert len(callback_calls) == 6  # 2 callbacks × 3 batches
        assert 3 in callback_calls  # First batch size
        assert 2 in callback_calls  # Last batch size
        assert "batch_count_3" in callback_calls
        assert "batch_count_2" in callback_calls

    def test_callbacks_with_empty_queryset(self) -> None:
        """Test callbacks are not called when queryset is empty."""
        callback_called = []

        def callback(batch):
            callback_called.append(len(batch))

        qs = User.objects.all()  # Empty queryset
        results = list(self.range_wrapper(qs, callbacks=[callback]))

        assert len(results) == 0
        assert len(callback_called) == 0  # No callbacks should be called

    def test_invalid_order_by_field(self) -> None:
        """Test error handling for invalid order_by field names."""
        qs = User.objects.all()

        # Test invalid field name
        with pytest.raises(InvalidQuerySetError, match="Invalid order_by field 'nonexistent'"):
            self.range_wrapper(qs, order_by="nonexistent")

    def test_enhanced_error_messages(self) -> None:
        """Test that error messages provide helpful guidance."""
        qs = User.objects.all()

        # Test non-unique field with detailed error message
        with pytest.raises(InvalidQuerySetError) as exc_info:
            self.range_wrapper(qs, order_by="name")

        error_message = str(exc_info.value)
        assert "must be unique to prevent infinite loops" in error_message
        assert "override_unique_safety_check=True" in error_message

    def test_pre_ordered_queryset_fails(self) -> None:
        """Test that querysets with existing ORDER BY clauses are rejected."""
        qs = User.objects.all().order_by("username")

        with pytest.raises(InvalidQuerySetError) as exc_info:
            self.range_wrapper(qs)

        error_message = str(exc_info.value)
        assert "existing ordering" in error_message
        assert "Remove any .order_by()" in error_message

    def test_sliced_queryset_with_offset_fails(self) -> None:
        """Test that querysets with non-zero offset are rejected."""
        self.create_user()
        qs = User.objects.all()[1:]  # Non-zero offset

        with pytest.raises(InvalidQuerySetError) as exc_info:
            self.range_wrapper(qs)

        error_message = str(exc_info.value)
        assert "non-zero offset" in error_message

    def test_sliced_queryset_with_limit_works(self) -> None:
        """Test that querysets with slice limits work correctly."""
        for i in range(10):
            self.create_user(username=f"user_{i:02d}")

        qs = User.objects.all()[:5]  # Limit but no offset
        results = list(self.range_wrapper(qs, step=2))

        # Should respect the slice limit
        assert len(results) == 5

    def test_boundary_conditions(self) -> None:
        """Test edge cases around step sizes and limits."""
        for i in range(5):
            self.create_user(username=f"user_{i:02d}")

        qs = User.objects.all()

        # Test step=1
        results = list(self.range_wrapper(qs, step=1))
        assert len(results) == 5

        # Test very large step (larger than dataset)
        results = list(self.range_wrapper(qs, step=1000))
        assert len(results) == 5

        # Test limit=1
        results = list(self.range_wrapper(qs, limit=1))
        assert len(results) == 1

        # Test limit=0
        results = list(self.range_wrapper(qs, limit=0))
        assert len(results) == 0

        # Test limit larger than dataset
        results = list(self.range_wrapper(qs, limit=100))
        assert len(results) == 5

    def test_step_larger_than_limit(self) -> None:
        """Test behavior when step is larger than limit."""
        for i in range(10):
            self.create_user(username=f"user_{i:02d}")

        qs = User.objects.all()
        results = list(self.range_wrapper(qs, step=1000, limit=5))

        # Should respect the limit
        assert len(results) == 5

    def test_duplicate_handling(self) -> None:
        """Test that duplicate detection works correctly."""
        # This is a regression test for the duplicate handling logic
        # that was refactored into _should_skip_duplicate()
        users = []
        for i in range(3):
            users.append(self.create_user(username=f"user_{i:02d}"))

        qs = User.objects.all()
        results = list(self.range_wrapper(qs, step=1))

        # Should get each user exactly once
        result_ids = [u.id for u in results]
        assert len(result_ids) == len(set(result_ids))  # No duplicates
        assert len(results) == 3

    def test_result_value_getter_with_callbacks(self) -> None:
        """Test that result_value_getter works correctly with callbacks."""
        for i in range(3):
            self.create_user(username=f"user_{i:02d}")

        callback_results = []

        def callback(batch):
            # Extract IDs from the batch using values_list format
            callback_results.extend([item[0] for item in batch])

        qs = User.objects.all().values_list("id")
        results = list(self.range_wrapper(
            qs,
            result_value_getter=lambda r: r[0],
            callbacks=[callback],
            step=1
        ))

        # Both results and callback should have the same IDs
        result_ids = [r[0] for r in results]
        assert len(result_ids) == 3
        assert set(result_ids) == set(callback_results)


@no_silo_test
class RangeQuerySetWrapperWithProgressBarTest(RangeQuerySetWrapperTest):
    range_wrapper = RangeQuerySetWrapperWithProgressBar

    def test_get_total_count(self) -> None:
        """Test that get_total_count returns accurate count."""
        for i in range(7):
            self.create_user(username=f"user_{i:02d}")

        qs = User.objects.all()
        wrapper = self.range_wrapper(qs, step=3)

        assert wrapper.get_total_count() == 7

    def test_get_total_count_with_filters(self) -> None:
        """Test get_total_count works with filtered querysets."""
        users = []
        for i in range(10):
            users.append(self.create_user(username=f"user_{i:02d}"))

        # Filter to only some users
        user_ids = [users[2].id, users[5].id, users[8].id]
        qs = User.objects.filter(id__in=user_ids)
        wrapper = self.range_wrapper(qs, step=2)

        assert wrapper.get_total_count() == 3

    def test_progress_bar_iteration(self) -> None:
        """Test that progress bar iteration works without errors."""
        for i in range(5):
            self.create_user(username=f"user_{i:02d}")

        qs = User.objects.all()
        wrapper = self.range_wrapper(qs, step=2)

        # This should work without throwing errors
        # We can't easily test the actual progress bar output in unit tests
        results = list(wrapper)
        assert len(results) == 5


@no_silo_test
class RangeQuerySetWrapperWithProgressBarApproxTest(RangeQuerySetWrapperTest):
    range_wrapper = RangeQuerySetWrapperWithProgressBarApprox

    def test_get_total_count_approximation(self) -> None:
        """Test that get_total_count returns a reasonable approximation."""
        # Create some users
        for i in range(10):
            self.create_user(username=f"user_{i:02d}")

        qs = User.objects.all()
        wrapper = self.range_wrapper(qs, step=3)

        # The approximation should be a non-negative integer
        count = wrapper.get_total_count()
        assert isinstance(count, int)
        assert count >= 0

        # For a small table like this, it should be reasonably accurate
        # but we can't guarantee exact accuracy since it's an approximation
        assert count >= 5  # Should be at least in the right ballpark

    def test_approximation_with_empty_table(self) -> None:
        """Test approximation when table is empty or doesn't exist."""
        qs = User.objects.all()  # Empty queryset
        wrapper = self.range_wrapper(qs, step=5)

        count = wrapper.get_total_count()
        assert isinstance(count, int)
        assert count >= 0  # Should not crash, should return 0 or small number


@no_silo_test
class WithProgressBarTest(TestCase):
    """Test the WithProgressBar utility class."""

    def test_with_known_count(self) -> None:
        """Test progress bar with known total count."""
        from sentry.utils.query import WithProgressBar

        items = [1, 2, 3, 4, 5]
        progress_bar = WithProgressBar(items, count=5, caption="Testing")

        results = list(progress_bar)
        assert results == items
        assert progress_bar.count == 5
        assert progress_bar.caption == "Testing"

    def test_with_unknown_count(self) -> None:
        """Test progress bar without known count (spinner mode)."""
        from sentry.utils.query import WithProgressBar

        items = ["a", "b", "c"]
        progress_bar = WithProgressBar(items, caption="Unknown Count")

        results = list(progress_bar)
        assert results == items
        assert progress_bar.count is None
        assert progress_bar.caption == "Unknown Count"

    def test_default_caption(self) -> None:
        """Test default caption when none provided."""
        from sentry.utils.query import WithProgressBar

        items = [1, 2]
        progress_bar = WithProgressBar(items)

        assert progress_bar.caption == "Progress"


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
