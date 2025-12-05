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
from django.db.utils import OperationalError

from sentry.db.models.base import Model
from sentry.services import eventstore
from sentry.utils.retries import ConditionalRetryPolicy

if TYPE_CHECKING:
    from sentry.services.eventstore.models import Event

_leaf_re = re.compile(r"^(UserReport|Event|Group)(.+)")


class InvalidQuerySetError(ValueError):
    pass


class TaskBulkQueryState(TypedDict):
    timestamp: str
    event_id: str


def task_run_batch_query(
    filter: eventstore.Filter,
    batch_size: int,
    referrer: str,
    state: TaskBulkQueryState | None = None,
    fetch_events: bool = True,
    tenant_ids: dict[str, int | str] | None = None,
) -> tuple[TaskBulkQueryState | None, list[Event]]:
    """
    A tool for batched queries similar in purpose to RangeQuerySetWrapper that
    is used for tasks in issue merge/unmerge/reprocessing.
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
    # persisted in task messages.
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
    Iterates through a queryset by chunking results by ``step`` and using GREATER THAN
    and LESS THAN queries on the primary key.

    Supports keyset pagination with multiple order_by fields for iterating over
    non-unique columns. When order_by is a list (e.g., ["last_seen", "id"]),
    uses compound cursor pagination to ensure all rows are returned even when
    the first field has duplicates.

    Very efficient, but ORDER BY statements will not work.
    """

    def __init__[M: Model](
        self,
        queryset: QuerySet[M, V],
        *,
        step: int = 1000,
        limit: int | None = None,
        min_id: int | None = None,
        order_by: str | Sequence[str] = "pk",
        callbacks: Sequence[Callable[[list[V]], None]] = (),
        result_value_getter: Callable[[V], Any] | None = None,
        override_unique_safety_check: bool = False,
        query_timeout_retries: int | None = None,
        retry_delay_seconds: float = 0.5,
    ):
        # Support for slicing
        if queryset.query.low_mark == 0 and not (
            queryset.query.order_by or queryset.query.extra_order_by
        ):
            if limit is None:
                limit = queryset.query.high_mark
            queryset.query.clear_limits()
        else:
            raise InvalidQuerySetError

        self.limit = limit
        self.desc = step < 0
        self.step = min(limit, abs(step)) if limit else abs(step)
        self.queryset = queryset
        self.min_value = min_id
        self.callbacks = callbacks
        self.result_value_getter = result_value_getter
        self.query_timeout_retries = query_timeout_retries
        self.retry_delay_seconds = retry_delay_seconds

        # Normalize order_by to a list
        if isinstance(order_by, str):
            self.order_by_fields = [order_by]
        else:
            self.order_by_fields = list(order_by)

        # For backwards compatibility, keep single field as string
        self.order_by = self.order_by_fields[0] if len(self.order_by_fields) == 1 else None

        # Validate that the last field in compound order_by is unique
        last_field = self.order_by_fields[-1]
        last_field_name = last_field if last_field != "pk" else "id"
        order_by_col = queryset.model._meta.get_field(last_field_name)
        if not override_unique_safety_check and (
            not isinstance(order_by_col, Field) or not order_by_col.unique
        ):
            raise InvalidQuerySetError(
                "The last order_by field must be unique to prevent infinite loops. "
                "For compound order_by, ensure the last field is unique (e.g., 'id'). "
                "If you're sure your data is unique, disable this check with "
                "`override_unique_safety_check=True`"
            )

    def _build_keyset_filter(self, cursor_values: dict[str, Any]) -> Q:
        """
        Build compound cursor filter for keyset pagination.

        For fields [f1, f2, f3] with cursor values [v1, v2, v3], builds:
        (f1 > v1) OR (f1 = v1 AND f2 > v2) OR (f1 = v1 AND f2 = v2 AND f3 > v3)

        For descending order, uses < instead of >.
        """
        q = Q()
        for i, field in enumerate(self.order_by_fields):
            # All previous fields must equal their cursor values
            prefix_eq = {f: cursor_values[f] for f in self.order_by_fields[:i]}
            # Current field must be greater (or less if descending)
            if self.desc:
                current_cmp = {f"{field}__lt": cursor_values[field]}
            else:
                current_cmp = {f"{field}__gt": cursor_values[field]}
            q |= Q(**prefix_eq, **current_cmp)
        return q

    def _get_cursor_values(self, result: V) -> dict[str, Any]:
        """Extract cursor values from a result for all order_by fields."""
        if self.result_value_getter:
            return self.result_value_getter(result)
        return {field: getattr(result, field) for field in self.order_by_fields}

    def __iter__(self) -> Iterator[V]:
        num = 0
        limit = self.limit

        # Build order_by clause
        if self.desc:
            order_clause = [f"-{f}" for f in self.order_by_fields]
        else:
            order_clause = list(self.order_by_fields)
        queryset = self.queryset.order_by(*order_clause)

        cursor_values: dict[str, Any] | None = None
        if self.min_value is not None and self.order_by:
            # Legacy support for single-field min_id
            cursor_values = {self.order_by: self.min_value}

        has_results = True
        while has_results:
            if limit and num >= limit:
                break

            if cursor_values is None:
                results_qs = queryset
            else:
                results_qs = queryset.filter(self._build_keyset_filter(cursor_values))

            if self.query_timeout_retries is not None:
                retries = self.query_timeout_retries
                retry_policy = ConditionalRetryPolicy(
                    test_function=lambda attempt, exc: attempt <= retries
                    and isinstance(exc, OperationalError),
                    delay_function=lambda i: self.retry_delay_seconds,
                )
                results = retry_policy(lambda: list(results_qs[0 : self.step]))
            else:
                results = list(results_qs[0 : self.step])

            for cb in self.callbacks:
                cb(results)

            for result in results:
                num += 1
                cursor_values = self._get_cursor_values(result)
                yield result

                if limit and num >= limit:
                    break

            has_results = bool(results) and len(results) == self.step


class RangeQuerySetWrapperWithProgressBar[V](RangeQuerySetWrapper[V]):
    def get_total_count(self) -> int:
        return self.queryset.count()

    def __iter__(self) -> Iterator[V]:
        total_count = self.get_total_count()
        iterator = super().__iter__()
        verbose_name = self.queryset.model._meta.verbose_name_plural or self.queryset.model.__name__
        return iter(WithProgressBar(iterator, total_count, verbose_name.title()))


class RangeQuerySetWrapperWithProgressBarApprox[V](RangeQuerySetWrapperWithProgressBar[V]):
    """
    Works the same as `RangeQuerySetWrapperWithProgressBar`, but approximates the number of rows
    in the table. This is intended for use on very large tables where we end up timing out
    attempting to get an accurate count.

    Note: This is only intended for queries that are iterating over an entire table. Will not
    produce a useful total count on filtered queries.
    """

    def get_total_count(self) -> int:
        cursor = connections[self.queryset.db].cursor()
        cursor.execute(
            "SELECT CAST(GREATEST(reltuples, 0) AS BIGINT) AS estimate FROM pg_class WHERE relname = %s",
            (self.queryset.model._meta.db_table,),
        )
        return cursor.fetchone()[0]


class WithProgressBar[V]:
    def __init__(
        self, iterator: Iterable[V], count: int | None = None, caption: str | None = None
    ) -> None:
        self.iterator = iterator
        self.count = count
        self.caption = caption or "Progress"

    def __iter__(self) -> Iterator[V]:
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
