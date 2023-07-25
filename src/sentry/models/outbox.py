from __future__ import annotations

import abc
import contextlib
import dataclasses
import datetime
import threading
from enum import IntEnum
from typing import Any, ContextManager, Generator, Iterable, List, Mapping, Type, TypeVar

import sentry_sdk
from django import db
from django.db import OperationalError, connections, models, router, transaction
from django.db.models import Max, Min
from django.db.transaction import Atomic
from django.dispatch import Signal
from django.http import HttpRequest
from django.utils import timezone
from typing_extensions import Self

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    JSONField,
    Model,
    control_silo_only_model,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.postgres.transactions import (
    django_test_transaction_water_mark,
    in_test_assert_no_transaction,
)
from sentry.services.hybrid_cloud import REGION_NAME_LENGTH
from sentry.silo import SiloMode, unguarded_write
from sentry.utils import metrics

THE_PAST = datetime.datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

_T = TypeVar("_T")


class OutboxFlushError(Exception):
    pass


class OutboxScope(IntEnum):
    ORGANIZATION_SCOPE = 0
    USER_SCOPE = 1
    WEBHOOK_SCOPE = 2
    AUDIT_LOG_SCOPE = 3
    USER_IP_SCOPE = 4
    INTEGRATION_SCOPE = 5
    APP_SCOPE = 6
    TEAM_SCOPE = 7
    PROVISION_SCOPE = 8

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
    ORGANIZATION_MEMBER_CREATE = 13  # Unused
    SEND_SIGNAL = 14
    ORGANIZATION_MAPPING_CUSTOMER_ID_UPDATE = 15
    ORGAUTHTOKEN_UPDATE = 16
    PROVISION_ORGANIZATION = 17
    PROVISION_SUBSCRIPTION = 18
    SEND_MODEL_SIGNAL = 19

    @classmethod
    def as_choices(cls):
        return [(i.value, i.value) for i in cls]


@dataclasses.dataclass
class OutboxWebhookPayload:
    method: str
    path: str
    uri: str
    headers: Mapping[str, Any]
    body: str


class WebhookProviderIdentifier(IntEnum):
    SLACK = 0
    GITHUB = 1
    JIRA = 2
    GITLAB = 3
    MSTEAMS = 4
    BITBUCKET = 5
    VSTS = 6
    JIRA_SERVER = 7
    GITHUB_ENTERPRISE = 8
    BITBUCKET_SERVER = 9


def _ensure_not_null(k: str, v: Any) -> Any:
    if v is None:
        raise ValueError(f"Attribute {k} was None, but it needed to be set!")
    return v


class OutboxBase(Model):
    sharding_columns: Iterable[str]
    coalesced_columns: Iterable[str]

    @classmethod
    def from_outbox_name(cls, name: str) -> Type[Self]:
        from django.apps import apps

        app_name, model_name = name.split(".")
        outbox_model = apps.get_model(app_name, model_name)
        assert issubclass(outbox_model, cls)
        return outbox_model

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
                scheduled_for=Min("scheduled_for"),
                id=Max("id"),
            )
            .filter(scheduled_for__lte=timezone.now())
            .order_by("scheduled_for", "id")
        )

    @classmethod
    def prepare_next_from_shard(cls, row: Mapping[str, Any]) -> OutboxBase | None:
        using = router.db_for_write(cls)
        with transaction.atomic(using=using, savepoint=False):
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

    def selected_messages_in_shard(
        self, latest_shard_row: OutboxBase | None = None
    ) -> models.QuerySet:
        filters: Mapping[str, Any] = (
            {} if latest_shard_row is None else dict(id__lte=latest_shard_row.id)
        )
        return self.objects.filter(**self.key_from(self.sharding_columns), **filters)

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
        return min(
            max(self.scheduled_for - self.scheduled_from, datetime.timedelta(seconds=1)),
            datetime.timedelta(hours=1),
        )

    def next_schedule(self, now: datetime.datetime) -> datetime.datetime:
        return now + (self.last_delay() * 2)

    def save(self, **kwds: Any):
        if _outbox_context.flushing_enabled:
            transaction.on_commit(lambda: self.drain_shard(), using=router.db_for_write(type(self)))

        tags = {"category": OutboxCategory(self.category).name}
        metrics.incr("outbox.saved", 1, tags=tags)
        super().save(**kwds)

    @contextlib.contextmanager
    def process_shard(
        self, latest_shard_row: OutboxBase | None
    ) -> Generator[OutboxBase | None, None, None]:
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
                    raise e

            yield next_shard_row

    @contextlib.contextmanager
    def process_coalesced(self) -> Generator[OutboxBase | None, None, None]:
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
                    try:
                        coalesced.send_signal()
                    except Exception as e:
                        sentry_sdk.capture_exception(e)
                        raise OutboxFlushError(f"Could not flush shard {repr(coalesced)}") from e

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
            # If we're not flushing all possible shards, and we don't see any immediately values,
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

                shard_row.process()

                if _test_processing_barrier:
                    _test_processing_barrier.wait()


# Outboxes bound from region silo -> control silo
class RegionOutboxBase(OutboxBase):
    def send_signal(self):
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

    __repr__ = sane_repr(*coalesced_columns)


@region_silo_only_model
class RegionOutbox(RegionOutboxBase):
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

    def send_signal(self):
        process_control_outbox.send(
            sender=OutboxCategory(self.category),
            payload=self.payload,
            region_name=self.region_name,
            object_identifier=self.object_identifier,
            shard_identifier=self.shard_identifier,
            shard_scope=self.shard_scope,
        )

    class Meta:
        abstract = True

    __repr__ = sane_repr(*coalesced_columns)

    @classmethod
    def get_webhook_payload_from_request(cls, request: HttpRequest) -> OutboxWebhookPayload:
        return OutboxWebhookPayload(
            method=request.method,
            path=request.get_full_path(),
            uri=request.get_raw_uri(),
            headers={k: v for k, v in request.headers.items()},
            body=request.body.decode(encoding="utf-8"),
        )

    @classmethod
    def get_webhook_payload_from_outbox(cls, payload: Mapping[str, Any]) -> OutboxWebhookPayload:
        return OutboxWebhookPayload(
            method=payload.get("method"),
            path=payload.get("path"),
            uri=payload.get("uri"),
            headers=payload.get("headers"),
            body=payload.get("body"),
        )

    @classmethod
    def for_webhook_update(
        cls,
        *,
        webhook_identifier: WebhookProviderIdentifier,
        region_names: List[str],
        request: HttpRequest,
    ) -> Iterable[ControlOutbox]:
        for region_name in region_names:
            result = cls()
            result.shard_scope = OutboxScope.WEBHOOK_SCOPE
            result.shard_identifier = webhook_identifier.value
            result.object_identifier = cls.next_object_identifier()
            result.category = OutboxCategory.WEBHOOK_PROXY
            result.region_name = region_name
            payload: OutboxWebhookPayload = result.get_webhook_payload_from_request(request)
            result.payload = dataclasses.asdict(payload)
            yield result


@control_silo_only_model
class ControlOutbox(ControlOutboxBase):
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


def outbox_silo_modes() -> List[SiloMode]:
    cur = SiloMode.get_current_mode()
    result: List[SiloMode] = []
    if cur != SiloMode.REGION:
        result.append(SiloMode.CONTROL)
    if cur != SiloMode.CONTROL:
        result.append(SiloMode.REGION)
    return result


class OutboxContext(threading.local):
    flushing_enabled: bool | None = None


_outbox_context = OutboxContext()


@contextlib.contextmanager
def outbox_context(inner: Atomic | None = None, flush: bool | None = None) -> ContextManager[None]:
    # If we don't specify our flush, use the outer specified override
    if flush is None:
        flush = _outbox_context.flushing_enabled
        # But if there is no outer override, default to True
        if flush is None:
            flush = True

    assert not flush or inner, "Must either set a transaction or flush=False"

    original = _outbox_context.flushing_enabled

    if inner:
        with unguarded_write(using=inner.using), inner:
            _outbox_context.flushing_enabled = flush
            try:
                yield
            finally:
                _outbox_context.flushing_enabled = original
    else:
        _outbox_context.flushing_enabled = flush
        try:
            yield
        finally:
            _outbox_context.flushing_enabled = original


process_region_outbox = Signal()  # ["payload", "object_identifier"]
process_control_outbox = Signal()  # ["payload", "region_name", "object_identifier"]
