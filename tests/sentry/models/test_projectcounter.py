from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from django.db import IntegrityError
from django.db.utils import OperationalError

from sentry.locks import locks
from sentry.models.counter import (
    LOW_WATER_RATIO,
    Counter,
    calculate_cached_id_block_size,
    increment_project_counter_in_cache,
    increment_project_counter_in_database,
    refill_cached_short_ids,
)
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.pytest.mocking import capture_results
from sentry.utils.redis import redis_clusters


@django_db_all
def test_increment(default_project) -> None:
    assert Counter.increment(default_project) == 1
    assert Counter.increment(default_project) == 2


@contextmanager
def patch_group_creation():
    group_creation_results: list[Group | Exception] = []
    group_creation_spy = MagicMock(
        side_effect=capture_results(Group.objects.create, group_creation_results)
    )
    with patch.object(Group.objects, "create", group_creation_spy):
        yield (group_creation_spy, group_creation_results)


def create_existing_group(project, message):
    with patch_group_creation() as patches:
        group_creation_spy, group_creation_results = patches

        event = save_new_event({"message": message}, project)
        assert event.group_id is not None
        group = Group.objects.get(id=event.group_id)

        assert (
            group.times_seen == 1
        ), "Error: No new group was created. This is probably because the given message matched that of an existing group."

        assert group_creation_spy.call_count == 1
        assert group_creation_results[0] == group

        return group


@django_db_all
def test_group_creation_simple(default_project) -> None:
    group = create_existing_group(default_project, "Dogs are great!")

    # See `create_existing_group` for more assertions
    assert group


@django_db_all
@pytest.mark.parametrize(
    "discrepancy",
    [1, 2, 3],
    ids=[" discrepancy = 1 ", " discrepancy = 2 ", " discrepancy = 3 "],
)
def test_group_creation_with_stuck_project_counter(
    default_project: Project, discrepancy: int
) -> None:
    project = default_project

    # Create enough groups that a discripancy larger than 1 will still land us on an existing group
    messages = [
        "Maisey is a silly dog",
        "Charlie is a goofy dog",
        "Bodhi is an adventurous dog",
        "Cory is a loyal dog",
    ]
    existing_groups = [create_existing_group(project, message) for message in messages]

    with patch_group_creation() as patches:
        group_creation_spy, group_creation_results = patches

        # Set the counter value such that it will try to create the next group with the same `short_id` as the
        # existing group
        counter = Counter.objects.get(project_id=project.id)

        counter.value = counter.value - discrepancy
        counter.save()

        # Populate the Redis cache with values that would cause the stuck counter scenario
        # We want to populate it with the short_id that would conflict with an existing group
        redis_key = f"pc:{project.id}"
        redis = redis_clusters.get("default")

        # Clear any existing values
        redis.delete(redis_key)

        # Get the short_id that would conflict (one of the existing group's short_ids)
        conflicting_short_id = existing_groups[0].short_id

        # Populate Redis with the conflicting short_id and some additional values
        # This will cause the Redis-based counter to return the conflicting short_id
        redis.rpush(
            redis_key, conflicting_short_id, conflicting_short_id + 1, conflicting_short_id + 2
        )

        # Change the message so the event will create a new group... or at least try to
        new_message = "Dogs are great!"
        assert new_message not in messages
        potentially_stuck_event = save_new_event({"message": new_message}, project)

        # Because of the incorrect counter value, we had to try twice to create the group.
        assert group_creation_spy.call_count == 2

        first_attempt_result, second_attempt_result = group_creation_results

        # The counter was indeed stuck...
        assert isinstance(first_attempt_result, IntegrityError)
        raised_error_message = first_attempt_result.args[0]
        possible_error_messages = [
            f"Key (project_id, short_id)=({project.id}, {existing_group.short_id}) already exists."
            for existing_group in existing_groups
        ]
        assert any(
            [
                possible_message in raised_error_message
                for possible_message in possible_error_messages
            ]
        )

        # ... but we did manage to create a new group after fixing it
        assert isinstance(second_attempt_result, Group)
        new_group = second_attempt_result
        assert potentially_stuck_event.group_id == new_group.id
        assert new_group.id not in [group.id for group in existing_groups]

        # And voila, now the counter's fixed and ready for the next new group
        counter = Counter.objects.get(project_id=project.id)
        assert counter.value == new_group.short_id

        # These will be helpful for the next set of assertions
        messages.append(new_message)
        existing_groups.append(new_group)

    # Clear the Redis cache to ensure the second part of the test works correctly
    # The stuck counter logic should have fixed the database counter, so we want
    # the Redis cache to be repopulated from the corrected database value
    redis_key = f"pc:{project.id}"
    redis = redis_clusters.get("default")
    redis.delete(redis_key)

    # Just to prove that it now works, here we go (new spies just for convenience)
    with patch_group_creation() as patches:
        group_creation_spy, group_creation_results = patches

        new_new_message = "Dogs are still great!"
        assert new_new_message not in messages
        hopefully_normal_event = save_new_event({"message": new_new_message}, project)

        # We didn't have to go through the stuck-counter-fixing process
        assert group_creation_spy.call_count == 1

        # We successfully created a new group
        assert isinstance(group_creation_results[0], Group)
        new_new_group = group_creation_results[0]
        assert hopefully_normal_event.group_id == new_new_group.id
        assert new_new_group.id not in [group.id for group in existing_groups]

        # And as before, the counter has been adjusted to be ready for the next new group
        counter = Counter.objects.get(project_id=project.id)
        block_size = calculate_cached_id_block_size(counter.value)
        assert counter.value >= new_new_group.short_id
        assert counter.value - new_new_group.short_id <= block_size


# === Redis-based Counter Tests ===
@pytest.fixture
def redis_mock():
    with patch("sentry.models.counter.redis_clusters") as mock:
        mock.get.return_value = MagicMock()
        yield mock.get.return_value


@django_db_all
def test_increment_project_counter_in_cache(default_project, redis_mock) -> None:
    # Enable the feature flag
    # Patch the pipeline context manager
    pipeline_mock = MagicMock()
    pipeline_mock.__enter__.return_value = pipeline_mock
    pipeline_mock.__exit__.return_value = None
    with patch.object(redis_mock, "pipeline", return_value=pipeline_mock):
        # First increment should trigger a refill
        pipeline_mock.execute.return_value = [None, 0]
        with patch("sentry.models.counter.refill_cached_short_ids.delay") as mock_refill:
            result = increment_project_counter_in_cache(default_project, using="default")
            mock_refill.assert_called_once_with(
                default_project.id,
                block_size=calculate_cached_id_block_size(1),
                using="default",
            )

        # After refill, should get a value from Redis
        pipeline_mock.execute.return_value = ["42", 100]
        result = increment_project_counter_in_cache(default_project, using="default")
        assert result == 42


@django_db_all
def test_refill_cached_short_ids(default_project, redis_mock) -> None:
    # Mock the lock
    lock_mock = MagicMock()
    lock_mock.locked.return_value = False
    lock_mock.__enter__ = MagicMock()
    lock_mock.__exit__ = MagicMock()
    block_size = calculate_cached_id_block_size(1)
    # Configure redis_mock to return an integer for llen
    redis_mock.llen.return_value = 0

    with (
        patch("sentry.models.counter.locks.get", return_value=lock_mock),
        patch("sentry.models.counter.increment_project_counter_in_database", return_value=100),
    ):
        refill_cached_short_ids(default_project.id, block_size)

        # Should have pushed BLOCK values to Redis
        redis_mock.rpush.assert_called_once()
        args = redis_mock.rpush.call_args[0]
        assert len(args) == block_size + 1  # +1 for the redis_key
        assert args[0] == f"pc:{default_project.id}"
        # Convert tuple to list for comparison
        assert list(args[1:]) == list(range(1, calculate_cached_id_block_size(1) + 1))


@django_db_all
def test_refill_cached_short_ids_lock_contention(default_project, redis_mock) -> None:
    # Mock the lock as already locked
    block_size = calculate_cached_id_block_size(1)
    lock = locks.get(
        f"pc:lock:{default_project.id}", duration=30, name="project_short_id_counter_refill"
    )
    with lock.acquire():
        refill_cached_short_ids(default_project.id, block_size)
        # Should not have called any Redis operations
        redis_mock.rpush.assert_not_called()  # noqa: F821


@django_db_all
def test_low_water_mark_trigger(default_project, redis_mock) -> None:
    pipeline_mock = MagicMock()
    pipeline_mock.__enter__.return_value = pipeline_mock
    pipeline_mock.__exit__.return_value = None
    block_size = calculate_cached_id_block_size(42)
    with patch.object(redis_mock, "pipeline", return_value=pipeline_mock):
        pipeline_mock.execute.return_value = [
            "42",
            block_size * LOW_WATER_RATIO - 1,
        ]
        with patch("sentry.models.counter.refill_cached_short_ids.delay") as mock_refill:
            result = increment_project_counter_in_cache(default_project, using="default")
            assert result == 42
            mock_refill.assert_called_once_with(
                default_project.id,
                block_size=block_size,
                using="default",
            )


@django_db_all
def test_fallback_to_database(default_project, redis_mock) -> None:
    # Enable the feature flag
    # Patch the pipeline context manager
    pipeline_mock = MagicMock()
    pipeline_mock.__enter__.return_value = pipeline_mock
    pipeline_mock.__exit__.return_value = None
    with patch.object(redis_mock, "pipeline", return_value=pipeline_mock):
        pipeline_mock.execute.return_value = [None, 0]
        with patch("sentry.models.counter.refill_cached_short_ids.delay"):
            with patch(
                "sentry.models.counter.increment_project_counter_in_database", return_value=42
            ) as mock_db:
                result = increment_project_counter_in_cache(default_project, using="default")
                assert result == 42
                mock_db.assert_called_once_with(default_project, using="default")


@django_db_all
def test_preallocation_end_to_end(default_project) -> None:
    # The first increment should trigger a refill
    with TaskRunner():
        current_value = Counter.increment(default_project)
    # see that the next counter value is 2 (incremented by 1)
    assert current_value == 1
    # see that the database was incremented by CACHED_ID_BLOCK_SIZE
    assert Counter.objects.get(
        project_id=default_project.id
    ).value == 1 + calculate_cached_id_block_size(1)
    # See that the redis key was populated with CACHED_ID_BLOCK_SIZE values
    redis_key = f"pc:{default_project.id}"
    redis = redis_clusters.get("default")
    assert redis.llen(redis_key) == calculate_cached_id_block_size(2)
    assert Counter.increment(default_project) == 2
    assert redis.llen(redis_key) == calculate_cached_id_block_size(2) - 1
    assert redis.lpop(redis_key) == "3"

    # see the the database value is still the same since we didn't refill
    assert Counter.objects.get(
        project_id=default_project.id
    ).value == 1 + calculate_cached_id_block_size(1)


@django_db_all
def test_preallocation_early_return(default_project) -> None:
    block_size = calculate_cached_id_block_size(1)
    with TaskRunner():
        current_value = Counter.increment(default_project)
    assert current_value == 1
    assert Counter.objects.get(project_id=default_project.id).value == current_value + block_size
    redis_key = f"pc:{default_project.id}"
    redis = redis_clusters.get("default")
    assert redis.llen(redis_key) == block_size

    # Directly call refill_cached_short_ids - should do nothing since we have enough values
    refill_cached_short_ids(default_project.id, block_size)
    assert Counter.objects.get(
        project_id=default_project.id
    ).value == current_value + calculate_cached_id_block_size(
        1
    )  # Value hasn't changed
    assert redis.llen(redis_key) == calculate_cached_id_block_size(
        1
    )  # Redis values haven't changed


def test_calculate_cached_id_block_size() -> None:
    assert calculate_cached_id_block_size(1) == 100
    assert calculate_cached_id_block_size(1000) == 1000


@django_db_all
def test_increment_project_counter_statement_timeout_retry(default_project) -> None:
    """Test that statement timeout errors trigger retries and eventually succeed."""
    call_count = 0

    def mock_execute_with_timeout(sql, params=None):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            # Fail first 2 attempts with statement timeout
            raise OperationalError(
                "canceling statement due to statement timeout\n"
                'CONTEXT:  while inserting index tuple (10255,244) in relation "sentry_projectcounter"\n'
            )
        # Third attempt succeeds
        return None

    with (
        patch("sentry.models.counter.connections") as mock_connections,
        patch("sentry.models.counter.time.sleep") as mock_sleep,
    ):
        mock_cursor = MagicMock()
        mock_cursor.execute = mock_execute_with_timeout
        mock_cursor.fetchone.return_value = [100]
        mock_connections.__getitem__.return_value.cursor.return_value.__enter__.return_value = (
            mock_cursor
        )

        result = increment_project_counter_in_database(default_project, delta=100)

        # Should have called execute 3 times (2 failures + 1 success)
        assert call_count == 3
        # Should have slept twice (after first and second failures)
        assert mock_sleep.call_count == 2
        # Should return the result
        assert result == 100


@django_db_all
def test_increment_project_counter_statement_timeout_exhausted(default_project) -> None:
    """Test that statement timeout errors exhaust retries and raise."""

    def mock_execute_with_timeout(sql, params=None):
        # Always fail with statement timeout
        raise OperationalError(
            "canceling statement due to statement timeout\n"
            'CONTEXT:  while inserting index tuple (10255,244) in relation "sentry_projectcounter"\n'
        )

    with (
        patch("sentry.models.counter.connections") as mock_connections,
        patch("sentry.models.counter.time.sleep") as mock_sleep,
    ):
        mock_cursor = MagicMock()
        mock_cursor.execute = mock_execute_with_timeout
        mock_connections.__getitem__.return_value.cursor.return_value.__enter__.return_value = (
            mock_cursor
        )

        # Should raise after 4 attempts (1 initial + 3 retries)
        with pytest.raises(OperationalError) as exc_info:
            increment_project_counter_in_database(default_project, delta=100)

        assert "canceling statement due to statement timeout" in str(exc_info.value)
        # Should have slept 3 times (after first 3 failures)
        assert mock_sleep.call_count == 3


@django_db_all
def test_increment_project_counter_non_timeout_operational_error(default_project) -> None:
    """Test that non-timeout OperationalErrors are raised immediately without retry."""

    def mock_execute_with_other_error(sql, params=None):
        # Different OperationalError that shouldn't trigger retry
        raise OperationalError("connection closed unexpectedly")

    with (
        patch("sentry.models.counter.connections") as mock_connections,
        patch("sentry.models.counter.time.sleep") as mock_sleep,
    ):
        mock_cursor = MagicMock()
        mock_cursor.execute = mock_execute_with_other_error
        mock_connections.__getitem__.return_value.cursor.return_value.__enter__.return_value = (
            mock_cursor
        )

        # Should raise immediately without retry
        with pytest.raises(OperationalError) as exc_info:
            increment_project_counter_in_database(default_project, delta=100)

        assert "connection closed unexpectedly" in str(exc_info.value)
        # Should not have slept (no retries)
        assert mock_sleep.call_count == 0
