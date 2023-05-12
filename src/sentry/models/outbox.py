from __future__ import annotations

import abc
import contextlib
import datetime
from enum import IntEnum
from typing import Any, Generator, Iterable, List, Mapping, Type, TypeVar

from django.db import connections, models, router, transaction
from django.db.models import Max
from django.dispatch import Signal
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    JSONField,
    Model,
    control_silo_only_model,
    region_silo_only_model,
    sane_repr,
)
from sentry.services.hybrid_cloud import REGION_NAME_LENGTH
from sentry.silo import SiloMode
from sentry.utils import metrics

THE_PAST = datetime.datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

_T = TypeVar("_T")


class OutboxScope(IntEnum):
    ORGANIZATION_SCOPE = 0
    USER_SCOPE = 1
    WEBHOOK_SCOPE = 2
    AUDIT_LOG_SCOPE = 3
    USER_IP_SCOPE = 4
    INTEGRATION_SCOPE = 5
    APP_SCOPE = 6
    TEAM_SCOPE = 7

    def __str__(self):
        return self.name

    @classmethod
    def as_choices(cls):
        return [(i.value, i.value) for i in cls]


class OutboxCategory(IntEnum):
    USER_UPDATE = 0
    WEBHOOK_PROXY = 1
    ORGANIZATION_UPDATE = 2
    ORGANIZATION_MEMBER_UPDATE = 3
    VERIFY_ORGANIZATION_MAPPING = 4
    AUDIT_LOG_EVENT = 5
    USER_IP_EVENT = 6
    INTEGRATION_UPDATE = 7
    PROJECT_UPDATE = 8
    API_APPLICATION_UPDATE = 9
    SENTRY_APP_INSTALLATION_UPDATE = 10
    TEAM_UPDATE = 11
    ORGANIZATION_INTEGRATION_UPDATE = 12
    ORGANIZATION_MEMBER_CREATE = 13

    @classmethod
    def as_choices(cls):
        return [(i.value, i.value) for i in cls]


class WebhookProviderIdentifier(IntEnum):
    SLACK = 0
    GITHUB = 1


def _ensure_not_null(k: str, v: Any) -> Any:
    if v is None:
        raise ValueError(f"Attribute {k} was None, but it needed to be set!")
    return v


class OutboxFlushError(Exception):
    pass


class OutboxBase(Model):
    sharding_columns: Iterable[str]
    coalesced_columns: Iterable[str]

    @classmethod
    def next_object_identifier(cls):
        using = router.db_for_write(cls)
        with transaction.atomic(using=using):
            with connections[using].cursor() as cursor:
                cursor.execute("SELECT nextval(%s)", [f"{cls._meta.db_table}_id_seq"])
                return cursor.fetchone()[0]

    @classmethod
    def find_scheduled_shards(cls) -> Iterable[Mapping[str, Any]]:
        return (
            cls.objects.values(*cls.sharding_columns)
            .annotate(
                scheduled_for=Max("scheduled_for"),
                id=Max("id"),
            )
            .filter(scheduled_for__lte=timezone.now())
            .order_by("scheduled_for", "id")
        )

    @classmethod
    def prepare_next_from_shard(cls, row: Mapping[str, Any]) -> OutboxBase | None:
        with transaction.atomic(savepoint=False):
            next_outbox: OutboxBase | None
            next_outbox = (
                cls(**row).selected_messages_in_shard().order_by("id").select_for_update().first()
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

    def key_from(self, attrs: Iterable[str]) -> Mapping[str, Any]:
        return {k: _ensure_not_null(k, getattr(self, k)) for k in attrs}

    def selected_messages_in_shard(self) -> models.QuerySet:
        return self.objects.filter(**self.key_from(self.sharding_columns))

    def select_coalesced_messages(self) -> models.QuerySet:
        return self.objects.filter(**self.key_from(self.coalesced_columns))

    class Meta:
        abstract = True

    __include_in_export__ = False

    # Different shard_scope, shard_identifier pairings of messages are always deliverable in parallel
    shard_scope = BoundedPositiveIntegerField(choices=OutboxScope.as_choices(), null=False)
    shard_identifier = BoundedBigIntegerField(null=False)

    # Objects of equal scope, shard_identifier, category, and object_identifier are coalesced in processing.
    category = BoundedPositiveIntegerField(choices=OutboxCategory.as_choices(), null=False)
    object_identifier = BoundedBigIntegerField(null=False)

    # payload is used for webhook payloads.
    payload = JSONField(null=True)

    # The point at which this object was scheduled, used as a diff from scheduled_for to determine the intended delay.
    scheduled_from = models.DateTimeField(null=False, default=timezone.now)
    # The point at which this object is intended to be replicated, used for backoff purposes.  Keep in mind that
    # the largest back off effectively applies to the entire 'shard' key.
    scheduled_for = models.DateTimeField(null=False, default=THE_PAST)

    def last_delay(self) -> datetime.timedelta:
        return max(self.scheduled_for - self.scheduled_from, datetime.timedelta(seconds=1))

    def next_schedule(self, now: datetime.datetime) -> datetime.datetime:
        return now + (self.last_delay() * 2)

    def save(self, **kwds: Any):
        tags = {"category": OutboxCategory(self.category).name}
        metrics.incr("outbox.saved", 1, tags=tags)
        super().save(**kwds)

    @contextlib.contextmanager
    def process_coalesced(self) -> Generator[OutboxBase | None, None, None]:
        # Do not, use a select for update here -- it is tempting, but a major performance issue.
        # we should simply accept the occasional multiple sends than to introduce hard locking.
        # so long as all objects sent are committed, and so long as any concurrent changes to data
        # result in a future processing, we should always converge on non stale values.
        coalesced: OutboxBase | None = self.select_coalesced_messages().last()
        yield coalesced

        # If the context block didn't raise we mark messages as completed by deleting them.
        if coalesced is not None:
            first_coalesced: OutboxBase = self.select_coalesced_messages().first() or coalesced
            deleted_count, _ = (
                self.select_coalesced_messages().filter(id__lte=coalesced.id).delete()
            )
            tags = {"category": OutboxCategory(self.category).name}
            metrics.incr("outbox.processed", deleted_count, tags=tags)
            metrics.timing(
                "outbox.processing_lag",
                datetime.datetime.now().timestamp() - first_coalesced.scheduled_from.timestamp(),
                tags=tags,
            )

    def process(self) -> bool:
        with self.process_coalesced() as coalesced:
            if coalesced is not None:
                with metrics.timer(
                    "outbox.send_signal.duration",
                    tags={"category": OutboxCategory(coalesced.category).name},
                ):
                    coalesced.send_signal()
                return True
        return False

    @abc.abstractmethod
    def send_signal(self):
        pass

    def drain_shard(self, max_updates_to_drain: int | None = None):
        runs = 0
        next_row: OutboxBase | None = self.selected_messages_in_shard().first()
        while next_row is not None and (
            max_updates_to_drain is None or runs < max_updates_to_drain
        ):
            runs += 1
            next_row.process()
            next_row: OutboxBase | None = self.selected_messages_in_shard().first()

        if next_row is not None:
            raise OutboxFlushError(
                f"Could not flush items from shard {self.key_from(self.sharding_columns)!r}"
            )


# Outboxes bound from region silo -> control silo
@region_silo_only_model
class RegionOutbox(OutboxBase):
    def send_signal(self):
        process_region_outbox.send(
            sender=OutboxCategory(self.category),
            payload=self.payload,
            object_identifier=self.object_identifier,
            shard_identifier=self.shard_identifier,
        )

    sharding_columns = ("shard_scope", "shard_identifier")
    coalesced_columns = ("shard_scope", "shard_identifier", "category", "object_identifier")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_regionoutbox"
        index_together = (
            (
                "shard_scope",
                "shard_identifier",
                "category",
                "object_identifier",
            ),
            (
                "shard_scope",
                "shard_identifier",
                "scheduled_for",
            ),
            ("shard_scope", "shard_identifier", "id"),
        )

    @classmethod
    def for_shard(cls: Type[_T], shard_scope: OutboxScope, shard_identifier: int) -> _T:
        """
        Logically, this is just an alias for the constructor of cls, but explicitly named to call out the intended
        semantic of creating and instance to invoke `drain_shard` on.
        """
        return cls(shard_scope=shard_scope, shard_identifier=shard_identifier)

    __repr__ = sane_repr("shard_scope", "shard_identifier", "category", "object_identifier")


# Outboxes bound from control silo -> region silo
@control_silo_only_model
class ControlOutbox(OutboxBase):
    sharding_columns = ("region_name", "shard_scope", "shard_identifier")
    coalesced_columns = (
        "region_name",
        "shard_scope",
        "shard_identifier",
        "category",
        "object_identifier",
    )

    region_name = models.CharField(max_length=REGION_NAME_LENGTH)

    def send_signal(self):
        process_control_outbox.send(
            sender=OutboxCategory(self.category),
            payload=self.payload,
            region_name=self.region_name,
            object_identifier=self.object_identifier,
            shard_identifier=self.shard_identifier,
        )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_controloutbox"
        index_together = (
            (
                "region_name",
                "shard_scope",
                "shard_identifier",
                "category",
                "object_identifier",
            ),
            (
                "region_name",
                "shard_scope",
                "shard_identifier",
                "scheduled_for",
            ),
            ("region_name", "shard_scope", "shard_identifier", "id"),
        )

    __repr__ = sane_repr(
        "region_name", "shard_scope", "shard_identifier", "category", "object_identifier"
    )

    @classmethod
    def for_webhook_update(
        cls,
        *,
        webhook_identifier: WebhookProviderIdentifier,
        region_names: List[str],
        payload=Mapping[str, Any],
    ) -> Iterable[ControlOutbox]:
        for region_name in region_names:
            result = cls()
            result.shard_scope = OutboxScope.WEBHOOK_SCOPE
            result.shard_identifier = webhook_identifier.value
            result.object_identifier = cls.next_object_identifier()
            result.category = OutboxCategory.WEBHOOK_PROXY
            result.region_name = region_name
            result.payload = payload
            yield result

    @classmethod
    def for_shard(
        cls: Type[_T], shard_scope: OutboxScope, shard_identifier: int, region_name: str
    ) -> _T:
        """
        Logically, this is just an alias for the constructor of cls, but explicitly named to call out the intended
        semantic of creating and instance to invoke `drain_shard` on.
        """
        return cls(
            shard_scope=shard_scope, shard_identifier=shard_identifier, region_name=region_name
        )


def outbox_silo_modes() -> List[SiloMode]:
    cur = SiloMode.get_current_mode()
    result: List[SiloMode] = []
    if cur != SiloMode.REGION:
        result.append(SiloMode.CONTROL)
    if cur != SiloMode.CONTROL:
        result.append(SiloMode.REGION)
    return result


process_region_outbox = Signal(providing_args=["payload", "object_identifier"])
process_control_outbox = Signal(providing_args=["payload", "region_name", "object_identifier"])
