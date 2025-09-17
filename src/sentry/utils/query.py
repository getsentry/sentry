from __future__ import annotations

import logging
import re
from collections.abc import Callable, Iterable, Iterator, Sequence
from typing import TYPE_CHECKING, Any, TypedDict

import click
from django.db import connections, router
from django.db.models.fields import Field
from django.db.models.query import QuerySet
from django.db.models.query_utils import Q
from django.db.models.sql.constants import ROW_COUNT
from django.db.models.sql.subqueries import DeleteQuery

from sentry.db.models.base import Model
from sentry.services import eventstore

if TYPE_CHECKING:
    from sentry.services.eventstore.models import Event

_leaf_re = re.compile(r"^(UserReport|Event|Group)(.+)")


class InvalidQuerySetError(ValueError):
    pass


class CeleryBulkQueryState(TypedDict):
    timestamp: str
    event_id: str


def celery_run_batch_query(
    filter: eventstore.Filter,
    batch_size: int,
    referrer: str,
    state: CeleryBulkQueryState | None = None,
    fetch_events: bool = True,
    tenant_ids: dict[str, int | str] | None = None,
) -> tuple[CeleryBulkQueryState | None, list[Event]]:
    """
    A tool for batched queries similar in purpose to RangeQuerySetWrapper that
    is used for celery tasks in issue merge/unmerge/reprocessing.
    """

    # We process events sorted in descending order by -timestamp, -event_id. We need
    # to include event_id as well as timestamp in the ordering criteria since:
    #
    # - Event timestamps are rounded to the second so multiple events are likely
    # to have the same timestamp.
    #
    # - When sorting by timestamp alone, Snuba may not give us a deterministic
    # order for events with the same timestamp.
    #
    # - We need to ensure that we do not skip any events between batches. If we
    # only sorted by timestamp < last_event.timestamp it would be possible to
    # have missed an event with the same timestamp as the last item in the
    # previous batch.
    #
    # state contains data about the last event ID and timestamp. Changing
    # the keys in here needs to be done carefully as the state object is
    # semi-persisted in celery queues.
    if state is not None:
        filter.conditions = filter.conditions or []
        filter.conditions.append(["timestamp", "<=", state["timestamp"]])
        filter.conditions.append(
            [["timestamp", "<", state["timestamp"]], ["event_id", "<", state["event_id"]]]
        )

    method = (
        eventstore.backend.get_events if fetch_events else eventstore.backend.get_unfetched_events
    )

    events = list(
        method(
            filter=filter,
            limit=batch_size,
            referrer=referrer,
            orderby=["-timestamp", "-event_id"],
            tenant_ids=tenant_ids,
        )
    )

    if events:
        state = {"timestamp": events[-1].timestamp, "event_id": events[-1].event_id}
    else:
        state = None

    return state, events


class RangeQuerySetWrapper[V]:
    """
    Efficiently iterates through a Django QuerySet by chunking results using
    GREATER THAN and LESS THAN queries on a specified ordering column.

    This wrapper is designed for processing large datasets in memory-efficient batches,
    making it ideal for bulk operations like data migrations, cleanup tasks, or
    batch processing.

    Key Features:
    - Memory efficient: processes data in configurable batch sizes
    - Cursor-based pagination: avoids OFFSET/LIMIT performance issues on large datasets
    - Handles both ascending and descending iteration
    - Supports custom ordering columns (must be unique)
    - Built-in callback system for batch processing
    - Automatic duplicate handling for edge cases

    Important Limitations:
    - Cannot be used with querysets that already have ORDER BY clauses
    - Ordering column must be unique to prevent infinite loops
    - Results are not guaranteed to be in the original queryset order

    Args:
        queryset: The Django QuerySet to iterate over
        step: Batch size for each iteration (default: 1000). Negative values iterate in descending order
        limit: Maximum number of items to process (default: None for unlimited)
        min_id: Starting value for iteration (useful for resuming interrupted operations)
        order_by: Column name to use for ordering (default: "pk", must be unique)
        callbacks: List of functions to call with each batch of results
        result_value_getter: Custom function to extract ordering value from results (needed for values_list queries)
        override_unique_safety_check: Skip uniqueness validation (use with caution)

    Examples:
        # Basic usage
        for user in RangeQuerySetWrapper(User.objects.all(), step=500):
            process_user(user)

        # With limit and custom ordering
        wrapper = RangeQuerySetWrapper(
            Event.objects.filter(project=project),
            step=100,
            limit=1000,
            order_by="timestamp"
        )

        # With callbacks for batch processing
        def log_progress(batch):
            logger.info(f"Processed batch of {len(batch)} items")

        wrapper = RangeQuerySetWrapper(
            queryset,
            step=1000,
            callbacks=[log_progress]
        )

    Raises:
        InvalidQuerySetError: If queryset has existing ordering or ordering column is not unique
    """

    def __init__[M: Model](
        self,
        queryset: QuerySet[M, V],
        *,
        step: int = 1000,
        limit: int | None = None,
        min_id: int | None = None,
        order_by: str = "pk",
        callbacks: Sequence[Callable[[list[V]], None]] = (),
        result_value_getter: Callable[[V], int] | None = None,
        override_unique_safety_check: bool = False,
    ):
        limit = self._validate_and_prepare_queryset(queryset, limit)
        self._configure_iteration_parameters(step, limit)
        self._set_instance_variables(queryset, min_id, order_by, callbacks, result_value_getter)
        self._validate_ordering_column(queryset, order_by, override_unique_safety_check)

    def _validate_and_prepare_queryset(
        self, queryset: QuerySet[Model, V], limit: int | None
    ) -> int | None:
        """
        Validates the queryset and handles Django's built-in slicing support.

        This method ensures the queryset doesn't have conflicting ORDER BY clauses
        and extracts any slice limits that may have been applied.
        """
        if queryset.query.low_mark == 0 and not (
            queryset.query.order_by or queryset.query.extra_order_by
        ):
            if limit is None:
                limit = queryset.query.high_mark
            queryset.query.clear_limits()
        else:
            raise InvalidQuerySetError(
                "RangeQuerySetWrapper cannot be used with querysets that have "
                "existing ordering or non-zero offset. Remove any .order_by() "
                "calls and use the order_by parameter instead."
            )
        return limit

    def _configure_iteration_parameters(self, step: int, limit: int | None) -> None:
        """Configure step size, limit, and iteration direction."""
        self.limit = limit
        self.is_descending = step < 0

        if limit:
            self.step = min(limit, abs(step))
        else:
            self.step = abs(step)

    def _set_instance_variables(
        self,
        queryset: QuerySet[Model, V],
        min_id: int | None,
        order_by: str,
        callbacks: Sequence[Callable[[list[V]], None]],
        result_value_getter: Callable[[V], int] | None,
    ) -> None:
        """Set the main instance variables."""
        self.queryset = queryset
        self.min_value = min_id
        self.order_by = order_by
        self.callbacks = callbacks
        self.result_value_getter = result_value_getter

    def _validate_ordering_column(
        self,
        queryset: QuerySet[Model, V],
        order_by: str,
        override_unique_safety_check: bool
    ) -> None:
        """
        Validates that the ordering column is unique to prevent infinite loops.

        Non-unique columns can cause the iterator to get stuck when multiple
        records have the same ordering value.
        """
        field_name = order_by if order_by != "pk" else "id"
        try:
            order_by_field = queryset.model._meta.get_field(field_name)
        except Exception as e:
            raise InvalidQuerySetError(
                f"Invalid order_by field '{order_by}': {e}"
            ) from e

        if not override_unique_safety_check and (
            not isinstance(order_by_field, Field) or not order_by_field.unique
        ):
            raise InvalidQuerySetError(
                f"Order by column '{order_by}' must be unique to prevent infinite loops. "
                f"Non-unique columns can cause the iterator to get stuck when multiple "
                f"records have the same ordering value. If you're certain your data is "
                f"unique for this column, you can disable this check by passing "
                f"'override_unique_safety_check=True'"
            )

    def __iter__(self) -> Iterator[V]:
        """
        Iterate through the queryset in batches using cursor-based pagination.

        This method implements efficient cursor pagination by filtering on the
        ordering column value from the last processed record, avoiding expensive
        OFFSET operations on large datasets.
        """
        current_order_value = self.min_value
        processed_count = 0
        last_object_pk: int | None = None

        ordered_queryset = self._get_ordered_queryset()

        while True:
            if self._should_stop_iteration(processed_count):
                break

            batch_start_count = processed_count
            batch_queryset = self._build_batch_queryset(ordered_queryset, current_order_value)
            batch_results = list(batch_queryset[0 : self.step])

            if not batch_results:
                break

            self._execute_callbacks(batch_results)

            for result in batch_results:
                if self._should_skip_duplicate(result, last_object_pk):
                    continue

                processed_count += 1
                last_object_pk = self._get_result_pk(result)
                current_order_value = self._get_result_order_value(result)

                yield result

            # If we processed no new items in this batch, we're done
            if processed_count <= batch_start_count:
                break

    def _get_ordered_queryset(self) -> QuerySet[Model, V]:
        """Apply the appropriate ordering to the queryset."""
        order_field = f"-{self.order_by}" if self.is_descending else self.order_by
        return self.queryset.order_by(order_field)

    def _should_stop_iteration(self, processed_count: int) -> bool:
        """Check if we should stop iterating based on the limit."""
        return self.limit is not None and processed_count >= self.limit

    def _build_batch_queryset(
        self,
        ordered_queryset: QuerySet[Model, V],
        current_order_value: int | None
    ) -> QuerySet[Model, V]:
        """
        Build the queryset for the current batch using cursor pagination.

        Filters the queryset to only include records with ordering values
        greater/less than the current cursor position.
        """
        if current_order_value is None:
            return ordered_queryset

        if self.is_descending:
            filter_condition = {f"{self.order_by}__lte": current_order_value}
        else:
            filter_condition = {f"{self.order_by}__gte": current_order_value}

        return ordered_queryset.filter(**filter_condition)

    def _execute_callbacks(self, batch_results: list[V]) -> None:
        """Execute all registered callbacks with the current batch."""
        for callback in self.callbacks:
            callback(batch_results)

    def _should_skip_duplicate(self, result: V, last_object_pk: int | None) -> bool:
        """
        Check if we should skip this result due to it being a duplicate.

        This handles edge cases where multiple records have the same ordering
        value and we need to avoid processing the same record twice.
        """
        if last_object_pk is None:
            return False
        current_pk = self._get_result_pk(result)
        return current_pk == last_object_pk

    def _get_result_pk(self, result: V) -> int:
        """Extract the primary key value from a result object."""
        if self.result_value_getter:
            return self.result_value_getter(result)
        return getattr(result, "pk")

    def _get_result_order_value(self, result: V) -> int:
        """
        Extract the ordering column value from a result object.

        This value is used as the cursor for the next batch iteration.
        We bind this value immediately to avoid issues with mutable objects.
        """
        if self.result_value_getter:
            return self.result_value_getter(result)
        return getattr(result, self.order_by)


class RangeQuerySetWrapperWithProgressBar[V](RangeQuerySetWrapper[V]):
    """
    RangeQuerySetWrapper with a visual progress bar for long-running operations.

    This wrapper displays a console progress bar showing the iteration progress,
    which is helpful for monitoring long-running batch operations or migrations.

    The progress bar shows:
    - Current progress as a visual bar
    - Percentage complete
    - Estimated time remaining
    - Processing rate (items/second)

    Note: Calls queryset.count() to get the total, which can be expensive on
    large tables. For very large tables, consider using
    RangeQuerySetWrapperWithProgressBarApprox instead.

    Example:
        # Process all users with progress bar
        wrapper = RangeQuerySetWrapperWithProgressBar(User.objects.all(), step=1000)
        for user in wrapper:
            migrate_user_data(user)
    """

    def get_total_count(self) -> int:
        """
        Get the total count of items to be processed.

        Uses Django's queryset.count() which executes a COUNT(*) query.
        This can be slow on large tables with complex filters.

        Returns:
            Total number of items in the queryset
        """
        return self.queryset.count()

    def __iter__(self) -> Iterator[V]:
        """
        Iterate with a progress bar showing completion status.

        The progress bar will display the model name and current progress.
        """
        total_count = self.get_total_count()
        iterator = super().__iter__()
        model_name = (
            self.queryset.model._meta.verbose_name_plural
            or self.queryset.model.__name__
        )
        return iter(WithProgressBar(iterator, total_count, model_name.title()))


class RangeQuerySetWrapperWithProgressBarApprox[V](RangeQuerySetWrapperWithProgressBar[V]):
    """
    RangeQuerySetWrapper with progress bar using approximate row count.

    Similar to RangeQuerySetWrapperWithProgressBar, but uses PostgreSQL's
    statistics to estimate the total row count instead of executing an
    expensive COUNT(*) query.

    This is ideal for:
    - Very large tables (millions+ rows) where COUNT(*) times out
    - Unfiltered queries that process entire tables
    - Operations where approximate progress is acceptable

    Important Limitations:
    - Only works with PostgreSQL databases
    - Only accurate for queries processing entire tables (no filters)
    - Estimates may be inaccurate if the table has been heavily modified
    - Progress percentage may exceed 100% or be inaccurate

    The approximation is based on PostgreSQL's pg_class.reltuples statistic,
    which is updated by VACUUM and ANALYZE operations.

    Example:
        # Process entire large table with approximate progress
        wrapper = RangeQuerySetWrapperWithProgressBarApprox(
            Event.objects.all(),  # No filters for accuracy
            step=5000
        )
        for event in wrapper:
            archive_event(event)

    Warning:
        Do not use with filtered querysets as the row count estimate
        will be inaccurate and misleading.
    """

    def get_total_count(self) -> int:
        """
        Get an approximate count using PostgreSQL table statistics.

        Uses pg_class.reltuples which contains the approximate number of
        live rows in the table, as estimated by the most recent VACUUM or ANALYZE.

        Returns:
            Estimated number of rows in the table (not the filtered queryset)

        Note:
            This returns the total table row count, not the count of rows
            matching any filters in the queryset. Only use this for queries
            that process entire tables without filters.
        """
        cursor = connections[self.queryset.db].cursor()
        cursor.execute(
            "SELECT CAST(GREATEST(reltuples, 0) AS BIGINT) AS estimate FROM pg_class WHERE relname = %s",
            (self.queryset.model._meta.db_table,),
        )
        result = cursor.fetchone()
        return result[0] if result else 0


class WithProgressBar[V]:
    """
    Wrapper that adds a console progress bar to any iterable.

    Uses Click's progress bar functionality to display progress for long-running
    iterations. The progress bar shows completion percentage, items processed,
    processing rate, and estimated time remaining.

    Args:
        iterator: The iterable to wrap with a progress bar
        count: Total number of items (if None, shows a spinner instead of percentage)
        caption: Label to display with the progress bar (default: "Progress")

    Example:
        items = [1, 2, 3, 4, 5]
        for item in WithProgressBar(items, len(items), "Processing"):
            process_item(item)
    """

    def __init__(
        self, iterator: Iterable[V], count: int | None = None, caption: str | None = None
    ) -> None:
        self.iterator = iterator
        self.count = count
        self.caption = caption or "Progress"

    def __iter__(self) -> Iterator[V]:
        """Iterate through the wrapped iterable with a progress bar."""
        with click.progressbar(self.iterator, length=self.count, label=self.caption) as it:
            yield from it


def bulk_delete_objects(
    model: type[Model],
    limit: int = 10000,
    transaction_id: str | None = None,
    logger: logging.Logger | None = None,
    **filters: Any,
) -> bool:
    qs = model.objects.filter(**filters).values_list("id")[:limit]

    delete_query = DeleteQuery(model)
    delete_query.add_q(Q(id__in=qs))
    n = delete_query.get_compiler(router.db_for_write(model)).execute_sql(ROW_COUNT)

    # `n` will be `None` if `qs` is an empty queryset
    has_more = n is not None and n > 0

    if has_more and logger is not None and _leaf_re.search(model.__name__) is None:
        logger.info(
            "object.delete.bulk_executed",
            extra=dict(filters, model=model.__name__, transaction_id=transaction_id),
        )

    return has_more
