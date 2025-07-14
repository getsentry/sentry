from __future__ import annotations

import logging
import re
from collections.abc import Iterable, Iterator
from typing import Any

import click
from django.db import connections, router
from django.db.models.query_utils import Q
from django.db.models.sql.constants import ROW_COUNT
from django.db.models.sql.subqueries import DeleteQuery

from sentry import eventstore
from sentry.db.models.base import Model

_leaf_re = re.compile(r"^(UserReport|Event|Group)(.+)")


class InvalidQuerySetError(ValueError):
    pass


def celery_run_batch_query(
    filter,
    batch_size,
    referrer,
    state=None,
    fetch_events=True,
    tenant_ids=None,
):
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


class RangeQuerySetWrapper:
    """
    Iterates through a queryset by chunking results by ``step`` and using GREATER THAN
    and LESS THAN queries on the primary key.

    Very efficient, but ORDER BY statements will not work.
    """

    def __init__(
        self,
        queryset,
        step=1000,
        limit=None,
        min_id=None,
        order_by="pk",
        callbacks=(),
        result_value_getter=None,
        override_unique_safety_check=False,
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
        if limit:
            self.step = min(limit, abs(step))
            self.desc = step < 0
        else:
            self.step = abs(step)
            self.desc = step < 0
        self.queryset = queryset
        self.min_value = min_id
        self.order_by = order_by
        self.callbacks = callbacks
        self.result_value_getter = result_value_getter

        order_by_col = queryset.model._meta.get_field(order_by if order_by != "pk" else "id")
        if not override_unique_safety_check and not order_by_col.unique:
            # TODO: Ideally we could fix this bug and support ordering by a non unique col
            raise InvalidQuerySetError(
                "Order by column must be unique, otherwise this wrapper can get "
                "stuck in an infinite loop. If you're sure your data is unique, "
                "you can disable this by passing "
                "`override_unique_safety_check=True`"
            )

    def __iter__(self):
        if self.min_value is not None:
            cur_value = self.min_value
        else:
            cur_value = None

        num = 0
        limit = self.limit

        queryset = self.queryset
        if self.desc:
            queryset = queryset.order_by("-%s" % self.order_by)
        else:
            queryset = queryset.order_by(self.order_by)

        # we implement basic cursor pagination for columns that are not unique
        last_object_pk: int | None = None
        has_results = True
        while has_results:
            if limit and num >= limit:
                break

            start = num

            if cur_value is None:
                results = queryset
            elif self.desc:
                results = queryset.filter(**{"%s__lte" % self.order_by: cur_value})
            else:
                results = queryset.filter(**{"%s__gte" % self.order_by: cur_value})

            results = list(results[0 : self.step])

            for cb in self.callbacks:
                cb(results)

            for result in results:
                pk = self.result_value_getter(result) if self.result_value_getter else result.pk
                if last_object_pk is not None and pk == last_object_pk:
                    continue

                # Need to bind value before yielding, because the caller
                # may mutate the value and we're left with a bad value.
                # This is commonly the case if iterating over and
                # deleting, because a Model.delete() mutates the `id`
                # to `None` causing the loop to exit early.
                num += 1
                last_object_pk = pk
                cur_value = (
                    self.result_value_getter(result)
                    if self.result_value_getter
                    else getattr(result, self.order_by)
                )

                yield result

            if cur_value is None:
                break

            has_results = num > start


class RangeQuerySetWrapperWithProgressBar(RangeQuerySetWrapper):
    def get_total_count(self):
        return self.queryset.count()

    def __iter__(self):
        total_count = self.get_total_count()
        iterator = super().__iter__()
        label = self.queryset.model._meta.verbose_name_plural.title()
        return iter(WithProgressBar(iterator, total_count, label))


class RangeQuerySetWrapperWithProgressBarApprox(RangeQuerySetWrapperWithProgressBar):
    """
    Works the same as `RangeQuerySetWrapperWithProgressBar`, but approximates the number of rows
    in the table. This is intended for use on very large tables where we end up timing out
    attempting to get an accurate count.

    Note: This is only intended for queries that are iterating over an entire table. Will not
    produce a useful total count on filtered queries.
    """

    def get_total_count(self):
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
