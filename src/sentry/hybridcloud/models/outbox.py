from __future__ import annotations

import abc
import contextlib
import datetime
import logging
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

logger = logging.getLogger(__name__)

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

    @contextlib.contextmanager
    def process_coalesced(
        self,
        is_synchronous_flush: bool,
    ) -> Generator[OutboxBase | None]:
        """
        Process a coalesced (grouped) batch of outbox messages.

        In our outbox design, many messages may be generated that share the same
        coalescing keys (for example, same shard_scope, shard_identifier, category,
        and object_identifier). Instead of processing all of them individually, we
        coalesce them—i.e. treat them as a single group—and only process the
        representative (the most recent message) while discarding the older ones.

        This context manager does the following:
          1. In an atomic transaction it selects a stable snapshot of the group
             by:
             - Locking for update (using select_for_update(nowait=True)) to prevent
               concurrent processors from picking up the same group.
             - Selecting the representative ("coalesced") record using descending order (by id)
               and the first (oldest) record using ascending order, used for metrics.
          2. It then collects all IDs (those with id less than the representative's)
             that belong to the same coalesced group.
          3. It "reserves" these messages by updating their scheduled_for field to a time
             in the future (e.g. now() + 1 hour) so that other processes will not reprocess them.
          4. The representative message is yielded so that external processing (e.g. sending
             a signal) can be performed outside of the transaction, minimizing the duration
             of locks.
          5. If an exception occurs during the yield (e.g. send_signal() fails), the scheduled_for
             values are reverted back to their original values to allow reprocessing.
          6. After yielding, it proceeds to delete the reserved messages in batches (in separate
             atomic blocks) and finally deletes the representative record if appropriate.
          7. Metrics regarding queue time, batch deletion success, processing lag, and any deletion
             errors are recorded.
          8. If lock contention occurs during selection/reservation, yields None to indicate another
             process is handling this batch.

        Args:
            is_synchronous_flush: A boolean flag indicating whether this is a synchronous flush operation.
                                Used for metric tagging.

        Returns:
            Generator yielding the representative (coalesced) outbox message if one is available,
            or None if there are no messages to process or if another process holds a lock.

        Raises:
            OperationalError: If a database error occurs that is not related to lock contention.
            Exception: If any other error occurs during processing.
        """
        # Determine the proper database alias for write operations.
        using = router.db_for_write(type(self))

        # Wrap the entire selection and reservation phase in a try/except block to catch
        # OperationalError. Specifically, if the error message indicates that a row lock
        # could not be obtained ("could not obtain lock"), then we yield None to signal that
        # another process is already handling this group.
        try:
            current_time = timezone.now()
            # Start an atomic transaction for a consistent snapshot of the coalesced group.
            with transaction.atomic(using=using):
                coalesced, first_coalesced = self._select_coalesced_messages(
                    current_time=current_time,
                )
                if coalesced is None:
                    yield None
                    return

                tags, scheduled_from, date_added, all_ids = self._prepare_processing_metrics(
                    coalesced=coalesced,
                    first_coalesced=first_coalesced,
                    is_synchronous_flush=is_synchronous_flush,
                )
                new_scheduled_for = self._reserve_messages_for_processing(
                    coalesced=coalesced,
                    all_ids=all_ids,
                    current_time=current_time,
                )

            # End of the selection/reservation phase. The transaction is now committed, and all locks
            # are released. Yield the representative coalesced message so that remote processing (like
            # sending signals) can be done without an open transaction.
            try:
                yield coalesced
            except Exception:
                # If an an exception occurs during processing (e.g. send_signal() raised an exception),
                # we want to revert the reservation update so that these messages are eligible for reprocessing.
                self._revert_reserved_messages(
                    coalesced=coalesced,
                    all_ids=all_ids,
                    new_scheduled_for=new_scheduled_for,
                    scheduled_from=scheduled_from,
                    tags=tags,
                )
                raise

            # After the yield, we now proceed to clean up (delete) the reserved messages.
            self._delete_reserved_messages(
                all_ids=all_ids,
                coalesced=coalesced,
                tags=tags,
                scheduled_from=scheduled_from,
                date_added=date_added,
            )

        except OperationalError as e:
            if "could not obtain lock" in str(e).lower():
                metrics.incr("outbox.lock_contention")
                # If an OperationalError occurs during the selection/reservation phase due to lock contention,
                # it is likely that another process is already handling this batch. In that case, yield None.
                yield None
            else:
                metrics.incr("outbox.lock_error")
                raise

    def _select_coalesced_messages(
        self, *, current_time: datetime.datetime
    ) -> tuple[OutboxBase | None, OutboxBase | None]:
        """Select the representative message from the group and the first (oldest) message."""

        # Select the representative message from the group, which is defined as the one
        # with the highest id. Only select messages that are due for processing (scheduled_for <= now).
        # We avoid selecting messages that are reserved in self._reserve_messages_for_processing().
        # Lock the row immediately to prevent concurrent processing.
        coalesced = (
            self.select_coalesced_messages()
            .filter(scheduled_for__lte=current_time)
            .select_for_update(nowait=True)
            .order_by("-id")
            .first()
        )
        if coalesced is None:
            return None, None

        # For timing and metrics, we also need to determine the first (oldest) record.
        # This is done with a second query ordering by ascending id. Only messages that are
        # due for processing (scheduled_for <= now) are considered. If no record is found,
        # fall back to the representative record.
        # We avoid selecting messages that are reserved in self._reserve_messages_for_processing().
        first_coalesced = (
            self.select_coalesced_messages()
            .filter(scheduled_for__lte=current_time)
            .select_for_update(nowait=True)
            .order_by("id")
            .first()
        ) or coalesced
        return coalesced, first_coalesced

    def _prepare_processing_metrics(
        self, *, coalesced: OutboxBase, first_coalesced: OutboxBase, is_synchronous_flush: bool
    ) -> tuple[dict, datetime.datetime, datetime.datetime, list[int]]:
        """Prepare metrics and collect IDs for processing."""
        # Build a tags dictionary for metrics purposes. The outbox category is included
        # to help report timing metrics by type and to show if the flush was synchronous.
        tags = {
            "category": OutboxCategory(self.category).name,
            "synchronous": int(is_synchronous_flush),
        }

        # Assert that we have a valid first record (which should always be true for a non-empty group).
        assert first_coalesced, "first_coalesced incorrectly set for non-empty coalesce group"

        # Record the net queue time metric using the date the first message was added.
        metrics.timing(
            "outbox.coalesced_net_queue_time",
            datetime.datetime.now(tz=datetime.UTC).timestamp()
            - first_coalesced.date_added.timestamp(),
            tags=tags,
        )

        # Store the representative (highest id) and timing values for later use.
        scheduled_from = first_coalesced.scheduled_from
        date_added = first_coalesced.date_added

        # Get a list of IDs for all messages in the group that are older than the coalesced record.
        # This is our snapshot of messages to process (delete) in this coalesced group.
        all_ids = list(
            self.select_coalesced_messages()
            .filter(id__lt=coalesced.id)
            .values_list("id", flat=True)
            .order_by("id")
        )

        return tags, scheduled_from, date_added, all_ids

    def _reserve_messages_for_processing(
        self, *, coalesced: OutboxBase, all_ids: list[int], current_time: datetime.datetime
    ) -> datetime.datetime:
        """Reserve messages by updating their scheduled_for time."""
        # Reserve the messages for processing. By updating scheduled_for to a point
        # in the future (now + 1 hour), we effectively signal that these messages are
        # being processed, thereby preventing any other drain process from picking them up.
        #
        # In practice, every worker is expected to only select and process messages with a scheduled_for timestamp
        # that is in the past (or otherwise eligible). As long as all processes honor this rule, no worker will
        # pick up these reserved rows until the reserved time has passed.
        new_scheduled_for = current_time + datetime.timedelta(hours=1)
        self.objects.filter(id__in=all_ids + [coalesced.id]).update(scheduled_for=new_scheduled_for)
        return new_scheduled_for

    def _revert_reserved_messages(
        self,
        *,
        coalesced: OutboxBase,
        all_ids: list[int],
        new_scheduled_for: datetime.datetime,
        scheduled_from: datetime.datetime,
        tags: dict,
    ) -> None:
        """Revert the scheduled_for timestamps for messages that failed processing."""
        # We wrap the revert update in an atomic transaction to ensure that the checks and update are atomic.
        # We only update messages that still have our temporary scheduled_for value (new_scheduled_for)
        # to avoid modifying messages that may have been picked up by other processes
        with transaction.atomic(using=router.db_for_write(type(self))):
            # Attempt to revert the scheduled_for timestamps for all affected messages
            # to avoid modifying messages that may have been picked up by other processes
            affected = self.objects.filter(
                id__in=all_ids + [coalesced.id],
                scheduled_for=new_scheduled_for,
            ).update(scheduled_for=scheduled_from)

            # Verify that all messages were reverted. i.e. all_ids plus the coalesced message (representative)
            # If the count doesn't match, it could indicate that some messages were
            # processed by another worker.
            expected_count = len(all_ids) + 1
            if affected != expected_count:
                logger.info(
                    "Revert update did not affect all messages",
                    extra={**tags, "affected": affected, "expected": expected_count},
                )
                metrics.incr("outbox.coalesced_revert_count_mismatch", tags=tags)

        metrics.incr("outbox.coalesced_yield_error", tags=tags)

    def _delete_reserved_messages(
        self,
        *,
        all_ids: list[int],
        coalesced: OutboxBase,
        tags: dict,
        scheduled_from: datetime.datetime,
        date_added: datetime.datetime,
    ) -> None:
        """Delete the reserved messages in batches and record metrics."""
        try:
            deleted_count = 0
            batch_size = 50  # Process deletions in batches to avoid long-running transactions.

            # Loop over the list of reserved IDs in chunks of batch_size.
            for i in range(0, len(all_ids), batch_size):
                batch_ids = all_ids[i : i + batch_size]
                # Use a new atomic block for each batch to ensure short and isolated transactions.
                with transaction.atomic(using=router.db_for_write(type(self))):
                    # Lock the batch of rows to ensure consistency before deletion.
                    batch_qs = self.objects.filter(id__in=batch_ids).select_for_update(nowait=True)
                    if batch_qs.exists():
                        # Delete the batch and capture the count of deleted rows.
                        batch_count = batch_qs.delete()[0]
                        deleted_count += batch_count
                        metrics.incr("outbox.batch_delete_success", batch_count, tags=tags)

            # Finally, process the representative message (highest id) if it should not be skipped.
            if not self.should_skip_shard():
                with transaction.atomic(using=router.db_for_write(type(self))):
                    final_qs = self.objects.filter(id=coalesced.id).select_for_update(nowait=True)
                    if final_qs.exists():
                        batch_count = final_qs.delete()[0]
                        deleted_count += batch_count
                        metrics.incr("outbox.final_delete_success", batch_count, tags=tags)

            # Record metrics indicating the total number of processed messages.
            metrics.incr("outbox.processed", deleted_count, tags=tags)
            # Record processing lag based on when the earliest message was scheduled.
            now_ts = datetime.datetime.now(tz=datetime.UTC).timestamp()
            metrics.timing(
                "outbox.processing_lag",
                now_ts - scheduled_from.timestamp(),
                tags=tags,
            )
            # Record the net processing time based on when the first message was added.
            metrics.timing(
                "outbox.coalesced_net_processing_time",
                now_ts - date_added.timestamp(),
                tags=tags,
            )

        except OperationalError as e:
            logger.info("outbox.delete_error", extra={"error": str(e)})
            # If an error occurs during deletion (e.g., failure to obtain a lock), increment an error metric
            # with details of the error and re-raise the exception.
            metrics.incr(
                "outbox.delete_error",
                tags=tags,
            )
            raise

    def _set_span_data_for_coalesced_message(self, span: Span, message: OutboxBase) -> None:
        tag_for_outbox = OutboxScope.get_tag_name(message.shard_scope)
        span.set_tag(tag_for_outbox, message.shard_identifier)
        span.set_data("outbox_id", message.id)
        span.set_data("outbox_shard_id", message.shard_identifier)
        span.set_tag("outbox_category", OutboxCategory(message.category).name)
        span.set_tag("outbox_scope", OutboxScope(message.shard_scope).name)

    def process(self, is_synchronous_flush: bool) -> bool:
        with self.process_coalesced(is_synchronous_flush=is_synchronous_flush) as coalesced:
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
        while True:
            with self.process_shard(latest_shard_row) as shard_row:
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
