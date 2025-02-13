from __future__ import annotations

import abc
import contextlib
import datetime
import threading
from collections.abc import Generator, Iterable, Mapping
from typing import Any, Self

import sentry_sdk
from django import db
from django.db import OperationalError, connections, models, router, transaction
from django.db.models import Count, Max, Min
from django.db.transaction import Atomic
from django.utils import timezone
from sentry_sdk.tracing import Span

from sentry import options
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    JSONField,
    Model,
    control_silo_model,
    region_silo_model,
    sane_repr,
)
from sentry.db.postgres.transactions import (
    django_test_transaction_water_mark,
    enforce_constraints,
    in_test_assert_no_transaction,
)
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.hybridcloud.outbox.signals import process_control_outbox, process_region_outbox
from sentry.hybridcloud.rpc import REGION_NAME_LENGTH
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.utils import metrics

THE_PAST = datetime.datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=datetime.UTC)


class OutboxFlushError(Exception):
    def __init__(self, message: str, outbox: OutboxBase) -> None:
        super().__init__(message)
        self.outbox = outbox


class InvalidOutboxError(Exception):
    pass


def _ensure_not_null(k: str, v: Any) -> Any:
    if v is None:
        raise ValueError(f"Attribute {k} was None, but it needed to be set!")
    return v


class OutboxBase(Model):
    sharding_columns: Iterable[str]
    coalesced_columns: Iterable[str]

    def should_skip_shard(self) -> bool:
        if self.shard_scope == OutboxScope.ORGANIZATION_SCOPE:
            return self.shard_identifier in options.get(
                "hybrid_cloud.authentication.disabled_organization_shards"
            )
        if self.shard_scope == OutboxScope.USER_SCOPE:
            return self.shard_identifier in options.get(
                "hybrid_cloud.authentication.disabled_user_shards"
            )
        return False

    @classmethod
    def from_outbox_name(cls, name: str) -> type[Self]:
        from django.apps import apps

        app_name, model_name = name.split(".")
        outbox_model = apps.get_model(app_name, model_name)
        assert issubclass(outbox_model, cls)
        return outbox_model

    @classmethod
    def next_object_identifier(cls) -> int:
        using = router.db_for_write(cls)
        with transaction.atomic(using=using):
            with connections[using].cursor() as cursor:
                cursor.execute("SELECT nextval(%s)", [f"{cls._meta.db_table}_id_seq"])
                return cursor.fetchone()[0]

    @classmethod
    def find_scheduled_shards(cls, low: int = 0, hi: int | None = None) -> list[Mapping[str, Any]]:
        q = cls.objects.values(*cls.sharding_columns).filter(
            scheduled_for__lte=timezone.now(), id__gte=low
        )
        if hi is not None:
            q = q.filter(id__lt=hi)

        return list(
            {k: row[k] for k in cls.sharding_columns}
            for row in q.annotate(
                scheduled_for=Min("scheduled_for"),
                max_id=Max("id"),
            ).order_by("scheduled_for", "max_id")
        )

    @classmethod
    def prepare_next_from_shard(cls, row: Mapping[str, Any]) -> Self | None:
        using = router.db_for_write(cls)
        try:
            with transaction.atomic(using=using, savepoint=False):
                next_outbox: OutboxBase | None
                next_outbox = (
                    cls(**row)
                    .selected_messages_in_shard()
                    .order_by("id")
                    .select_for_update(nowait=True)
                    .first()
                )
                if not next_outbox:
                    return None

                # We rely on 'proof of failure by remaining' to handle retries -- basically, by scheduling this shard, we
                # expect all objects to be drained before the next schedule comes around, or else we will run again.
                # Note that the system does not strongly protect against concurrent processing -- this is expected in the
                # case of drains, for instance.
                now = timezone.now()
                next_outbox.selected_messages_in_shard().update(
                    scheduled_for=next_outbox.next_schedule(now), scheduled_from=now
                )

                return next_outbox

        except OperationalError as e:
            # If concurrent locking is happening on the table, gracefully pass and allow
            # that work to process.
            if "LockNotAvailable" in str(e):
                return None
            else:
                raise

    def key_from(self, attrs: Iterable[str]) -> Mapping[str, Any]:
        return {k: _ensure_not_null(k, getattr(self, k)) for k in attrs}

    def selected_messages_in_shard(
        self, latest_shard_row: OutboxBase | None = None
    ) -> models.QuerySet[Self]:
        filters: Mapping[str, Any] = (
            {} if latest_shard_row is None else dict(id__lte=latest_shard_row.id)
        )
        return self.objects.filter(**self.key_from(self.sharding_columns), **filters)

    def select_coalesced_messages(self) -> models.QuerySet[Self]:
        return self.objects.filter(**self.key_from(self.coalesced_columns))

    class Meta:
        abstract = True

    __relocation_scope__ = RelocationScope.Excluded

    # Different shard_scope, shard_identifier pairings of messages are always deliverable in parallel
    shard_scope = BoundedPositiveIntegerField(choices=OutboxScope.as_choices(), null=False)
    shard_identifier = BoundedBigIntegerField(null=False)

    # Objects of equal scope, shard_identifier, category, and object_identifier are coalesced in processing.
    category = BoundedPositiveIntegerField(choices=OutboxCategory.as_choices(), null=False)
    object_identifier = BoundedBigIntegerField(null=False)

    # payload is used for webhook payloads.
    payload: models.Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(null=True)

    # The point at which this object was scheduled, used as a diff from scheduled_for to determine the intended delay.
    scheduled_from = models.DateTimeField(null=False, default=timezone.now)
    # The point at which this object is intended to be replicated, used for backoff purposes.  Keep in mind that
    # the largest back off effectively applies to the entire 'shard' key.
    scheduled_for = models.DateTimeField(null=False, default=THE_PAST)

    # Initial creation date for the outbox which should not be modified. Used for lag time calculation.
    date_added = models.DateTimeField(null=False, default=timezone.now, editable=False)

    def last_delay(self) -> datetime.timedelta:
        return max(self.scheduled_for - self.scheduled_from, datetime.timedelta(seconds=1))

    def next_schedule(self, now: datetime.datetime) -> datetime.datetime:
        return now + min((self.last_delay() * 2), datetime.timedelta(hours=1))

    def save(self, **kwds: Any) -> None:  # type: ignore[override]
        if not OutboxScope.scope_has_category(self.shard_scope, self.category):
            raise InvalidOutboxError(
                f"Outbox.category {self.category} ({OutboxCategory(self.category).name}) not configured for scope {self.shard_scope} ({OutboxScope(self.shard_scope).name})"
            )

        if _outbox_context.flushing_enabled:
            transaction.on_commit(lambda: self.drain_shard(), using=router.db_for_write(type(self)))

        tags = {"category": OutboxCategory(self.category).name}
        metrics.incr("outbox.saved", 1, tags=tags)
        super().save(**kwds)

    @contextlib.contextmanager
    def process_shard(self, latest_shard_row: OutboxBase | None) -> Generator[OutboxBase | None]:
        flush_all: bool = not bool(latest_shard_row)
        next_shard_row: OutboxBase | None
        using: str = db.router.db_for_write(type(self))
        with transaction.atomic(using=using), django_test_transaction_water_mark(using=using):
            try:
                # Could be the same as latest_shard_row
                next_shard_row = (
                    self.selected_messages_in_shard(latest_shard_row=latest_shard_row)
                    .select_for_update(nowait=flush_all)
                    .first()
                )
            except OperationalError as e:
                if "LockNotAvailable" in str(e):
                    # If a non task flush process is running already, allow it to proceed without contention.
                    next_shard_row = None
                else:
                    raise

            yield next_shard_row

    def process_coalesced_messages(
        self,
        is_synchronous_flush: bool,
    ) -> bool:
        """
        Process a coalesced group of messages. This takes a few steps:

        1. We need to reserve the group of messages by getting locks on the top
        and bottom of the coalesce group.
        2. We advance the schedule_for of all messages in the coalesce group. This
        combined with the locks from 1. prevent concurrent deliveries of the same messages.
        3. We commit the update transaction, and call the signal handler. Signal handler
        need to be called outside of transactions as they frequently use RPC which
        can have long latency. If a transaction was held during this time it could
        hit statement timeouts and the transaction would be aborted.
        4. Once the signal handler completes, we delete the coalesced messages
        as they have been 'delivered'.

        If the signal handler fails, we leave the messages alone and they will be
        processed in the future when their schedule is due again.
        """
        using = router.db_for_write(type(self))
        tags: dict[str, int | str] = {"category": "None", "synchronous": int(is_synchronous_flush)}

        try:
            now = timezone.now()
            with transaction.atomic(using=using, savepoint=False):
                # TODO could be better to get a lock on all the messages in the group
                coalesced: OutboxBase | None = (
                    self.select_coalesced_messages().select_for_update(nowait=True).last()
                )
                first_coalesced: OutboxBase | None = (
                    self.select_coalesced_messages().select_for_update(nowait=True).first()
                    or coalesced
                )
                if coalesced is None:
                    return False

                tags["category"] = OutboxCategory(self.category).name
                assert (
                    first_coalesced
                ), "first_coalesced incorrectly set for non-empty coalesce group"
                metrics.timing(
                    "outbox.coalesced_net_queue_time",
                    now.timestamp() - first_coalesced.date_added.timestamp(),
                    tags=tags,
                )
                # Get all ids/scheduled times for coalesced messages
                reserved_ids = list(
                    self.select_coalesced_messages()
                    .filter(id__lt=coalesced.id)
                    .values_list("id", flat=True)
                    .order_by("id")
                )

                # Reserve all messages in the coalesce group
                self.objects.filter(
                    id__in=reserved_ids,
                ).update(scheduled_for=coalesced.next_schedule(now))
        except OperationalError:
            # We can hit lock contention here. If we do, skip the group and try later.
            return False

        if not self.should_skip_shard():
            # With the reservation transaction commited, call signal handler
            with (
                metrics.timer(
                    "outbox.send_signal.duration",
                    tags={
                        "category": OutboxCategory(coalesced.category).name,
                        "synchronous": int(is_synchronous_flush),
                    },
                ),
                sentry_sdk.start_span(op="outbox.process") as span,
            ):
                self._set_span_data_for_coalesced_message(span=span, message=coalesced)
                try:
                    coalesced.send_signal()
                except Exception as e:
                    raise OutboxFlushError(
                        f"Could not flush shard category={coalesced.category} ({OutboxCategory(coalesced.category).name})",
                        coalesced,
                    ) from e

        try:
            # The signal handler completed, delete the coalesced messages to awknowledge them.
            processed = False
            deleted_count = 0
            with transaction.atomic(using=using):
                self.objects.filter(id__in=reserved_ids).delete()
                deleted_count = len(reserved_ids)

                if not self.should_skip_shard():
                    deleted_count += 1
                    coalesced.delete()
                    processed = True

            metrics.incr("outbox.processed", deleted_count, tags=tags)
            metrics.timing(
                "outbox.processing_lag",
                datetime.datetime.now(tz=datetime.UTC).timestamp()
                - first_coalesced.scheduled_from.timestamp(),
                tags=tags,
            )
            metrics.timing(
                "outbox.coalesced_net_processing_time",
                datetime.datetime.now(tz=datetime.UTC).timestamp()
                - first_coalesced.date_added.timestamp(),
                tags=tags,
            )
            return processed
        except Exception as err:
            sentry_sdk.capture_exception(err)
            return False

    @contextlib.contextmanager
    def process_coalesced(
        self,
        is_synchronous_flush: bool,
    ) -> Generator[OutboxBase | None]:
        # For the current outbox, find all the coalesced messages that share a category + object_identifier
        coalesced: OutboxBase | None = self.select_coalesced_messages().last()
        first_coalesced: OutboxBase | None = self.select_coalesced_messages().first() or coalesced
        tags: dict[str, int | str] = {"category": "None", "synchronous": int(is_synchronous_flush)}

        if coalesced is not None:
            tags["category"] = OutboxCategory(self.category).name
            assert first_coalesced, "first_coalesced incorrectly set for non-empty coalesce group"
            metrics.timing(
                "outbox.coalesced_net_queue_time",
                datetime.datetime.now(tz=datetime.UTC).timestamp()
                - first_coalesced.date_added.timestamp(),
                tags=tags,
            )

        yield coalesced

        # If the context block didn't raise we mark messages as completed by deleting them.
        if coalesced is not None:
            assert first_coalesced, "first_coalesced incorrectly set for non-empty coalesce group"
            deleted_count = 0

            # Use a fetch and delete loop as doing cleanup in a single query
            # causes timeouts with large datasets. Fetch in batches of 50 and
            # Apply the ID condition in python as filtering rows in postgres
            # leads to timeouts.
            while True:
                batch = self.select_coalesced_messages().values_list("id", flat=True)[:50]
                delete_ids = [item_id for item_id in batch if item_id < coalesced.id]
                if not len(delete_ids):
                    break
                self.objects.filter(id__in=delete_ids).delete()
                deleted_count += len(delete_ids)

            # Only process the highest id after the others have been batch processed.
            # It's not guaranteed that the ordering of the batch processing is in order,
            # meaning that failures during deletion could leave an old, staler outbox
            # alive.
            if not self.should_skip_shard():
                deleted_count += 1
                coalesced.delete()

            metrics.incr("outbox.processed", deleted_count, tags=tags)
            metrics.timing(
                "outbox.processing_lag",
                datetime.datetime.now(tz=datetime.UTC).timestamp()
                - first_coalesced.scheduled_from.timestamp(),
                tags=tags,
            )
            metrics.timing(
                "outbox.coalesced_net_processing_time",
                datetime.datetime.now(tz=datetime.UTC).timestamp()
                - first_coalesced.date_added.timestamp(),
                tags=tags,
            )

    def _set_span_data_for_coalesced_message(self, span: Span, message: OutboxBase) -> None:
        tag_for_outbox = OutboxScope.get_tag_name(message.shard_scope)
        span.set_tag(tag_for_outbox, message.shard_identifier)
        span.set_data("outbox_id", message.id)
        span.set_data("outbox_shard_id", message.shard_identifier)
        span.set_tag("outbox_category", OutboxCategory(message.category).name)
        span.set_tag("outbox_scope", OutboxScope(message.shard_scope).name)

    def process(self, is_synchronous_flush: bool) -> bool:
        with self.process_coalesced(is_synchronous_flush=is_synchronous_flush) as coalesced:
            # coalesced is the latest record in the coalesce group
            # cleanup of coalesce rows is done in the exit of the context manager
            if coalesced is not None and not self.should_skip_shard():
                with (
                    metrics.timer(
                        "outbox.send_signal.duration",
                        tags={
                            "category": OutboxCategory(coalesced.category).name,
                            "synchronous": int(is_synchronous_flush),
                        },
                    ),
                    sentry_sdk.start_span(op="outbox.process") as span,
                ):
                    self._set_span_data_for_coalesced_message(span=span, message=coalesced)
                    try:
                        coalesced.send_signal()
                    except Exception as e:
                        raise OutboxFlushError(
                            f"Could not flush shard category={coalesced.category} ({OutboxCategory(coalesced.category).name})",
                            coalesced,
                        ) from e

                return True
        return False

    @abc.abstractmethod
    def send_signal(self) -> None:
        pass

    def drain_shard(
        self, flush_all: bool = False, _test_processing_barrier: threading.Barrier | None = None
    ) -> None:
        in_test_assert_no_transaction(
            "drain_shard should only be called outside of any active transaction!"
        )
        # When we are flushing in a local context, we don't care about outboxes created concurrently --
        # at best our logic depends on previously created outboxes.
        latest_shard_row: OutboxBase | None = None
        if not flush_all:
            latest_shard_row = self.selected_messages_in_shard().last()
            # If we're not flushing all possible shards, and we don't see any immediate values,
            # drop.
            if latest_shard_row is None:
                return

        shard_row: OutboxBase | None
        reservation_shards = options.get("hybrid_cloud.outbox.reservation_shards")
        if self.shard_scope in reservation_shards:
            # Reservation shard logic does not fire signal handlers within a database transaction
            while True:
                # Fetch messages from the shard until it is empty
                next_outbox = self.selected_messages_in_shard(
                    latest_shard_row=latest_shard_row
                ).first()
                if next_outbox is None:
                    break

                if _test_processing_barrier:
                    _test_processing_barrier.wait()

                processed = next_outbox.process_coalesced_messages(
                    is_synchronous_flush=not flush_all
                )

                if _test_processing_barrier:
                    _test_processing_barrier.wait()

                if not processed:
                    break
        else:
            while True:
                with self.process_shard(latest_shard_row) as shard_row:
                    # All of this logic is in the select_for_update block, with row locks
                    if shard_row is None:
                        break

                    if _test_processing_barrier:
                        _test_processing_barrier.wait()

                    processed = shard_row.process(is_synchronous_flush=not flush_all)

                    if _test_processing_barrier:
                        _test_processing_barrier.wait()

                    if not processed:
                        break

    @classmethod
    def get_shard_depths_descending(cls, limit: int | None = 10) -> list[dict[str, int | str]]:
        """
        Queries all outbox shards for their total depth, aggregated by their
        sharding columns as specified by the outbox class implementation.

        :param limit: Limits the query to the top N rows with the greatest shard
        depth. If limit is None, the entire set of rows will be returned.
        :return: A list of dictionaries, containing shard depths and shard
        relevant column values.
        """
        if limit is not None:
            assert limit > 0, "Limit must be a positive integer if specified"

        base_depth_query = (
            cls.objects.values(*cls.sharding_columns).annotate(depth=Count("*")).order_by("-depth")
        )

        if limit is not None:
            base_depth_query = base_depth_query[0:limit]

        aggregated_shard_information = list()
        for shard_row in base_depth_query:
            shard_information = {
                shard_column: shard_row[shard_column] for shard_column in cls.sharding_columns
            }
            shard_information["depth"] = shard_row["depth"]
            aggregated_shard_information.append(shard_information)

        return aggregated_shard_information

    @classmethod
    def get_total_outbox_count(cls) -> int:
        return cls.objects.count()


# Outboxes bound from region silo -> control silo
class RegionOutboxBase(OutboxBase):
    def send_signal(self) -> None:
        process_region_outbox.send(
            sender=OutboxCategory(self.category),
            payload=self.payload,
            object_identifier=self.object_identifier,
            shard_identifier=self.shard_identifier,
            shard_scope=self.shard_scope,
        )

    sharding_columns = ("shard_scope", "shard_identifier")
    coalesced_columns = ("shard_scope", "shard_identifier", "category", "object_identifier")

    class Meta:
        abstract = True

    __repr__ = sane_repr("payload", *coalesced_columns)


@region_silo_model
class RegionOutbox(RegionOutboxBase):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_regionoutbox"
        indexes = (
            models.Index(
                fields=(
                    "shard_scope",
                    "shard_identifier",
                    "category",
                    "object_identifier",
                )
            ),
            models.Index(
                fields=(
                    "shard_scope",
                    "shard_identifier",
                    "scheduled_for",
                )
            ),
            models.Index(fields=("shard_scope", "shard_identifier", "id")),
        )


# Outboxes bound from control silo -> region silo
class ControlOutboxBase(OutboxBase):
    sharding_columns = ("region_name", "shard_scope", "shard_identifier")
    coalesced_columns = (
        "region_name",
        "shard_scope",
        "shard_identifier",
        "category",
        "object_identifier",
    )

    region_name = models.CharField(max_length=REGION_NAME_LENGTH)

    def send_signal(self) -> None:
        process_control_outbox.send(
            sender=OutboxCategory(self.category),
            payload=self.payload,
            region_name=self.region_name,
            object_identifier=self.object_identifier,
            shard_identifier=self.shard_identifier,
            shard_scope=self.shard_scope,
            date_added=self.date_added,
            scheduled_for=self.scheduled_for,
        )

    class Meta:
        abstract = True

    __repr__ = sane_repr("payload", *coalesced_columns)


@control_silo_model
class ControlOutbox(ControlOutboxBase):
    class Meta:
        app_label = "sentry"
        db_table = "sentry_controloutbox"
        indexes = (
            models.Index(
                fields=(
                    "region_name",
                    "shard_scope",
                    "shard_identifier",
                    "category",
                    "object_identifier",
                )
            ),
            models.Index(
                fields=(
                    "region_name",
                    "shard_scope",
                    "shard_identifier",
                    "scheduled_for",
                )
            ),
            models.Index(fields=("region_name", "shard_scope", "shard_identifier", "id")),
        )


def outbox_silo_modes() -> list[SiloMode]:
    cur = SiloMode.get_current_mode()
    result: list[SiloMode] = []
    if cur != SiloMode.REGION:
        result.append(SiloMode.CONTROL)
    if cur != SiloMode.CONTROL:
        result.append(SiloMode.REGION)
    return result


class OutboxContext(threading.local):
    flushing_enabled: bool | None = None


_outbox_context = OutboxContext()


@contextlib.contextmanager
def outbox_context(
    inner: Atomic | None = None, flush: bool | None = None
) -> Generator[Atomic | None]:
    # If we don't specify our flush, use the outer specified override
    if flush is None:
        flush = _outbox_context.flushing_enabled
        # But if there is no outer override, default to True
        if flush is None:
            flush = True

    assert not flush or inner, "Must either set a transaction or flush=False"

    original = _outbox_context.flushing_enabled

    if inner:
        assert inner.using is not None
        with unguarded_write(using=inner.using), enforce_constraints(inner):
            _outbox_context.flushing_enabled = flush
            try:
                yield inner
            finally:
                _outbox_context.flushing_enabled = original
    else:
        _outbox_context.flushing_enabled = flush
        try:
            yield None
        finally:
            _outbox_context.flushing_enabled = original
