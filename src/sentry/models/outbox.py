from __future__ import annotations

import abc
import contextlib
import dataclasses
import datetime
import threading
from enum import IntEnum
from typing import (
    Any,
    Collection,
    Dict,
    Generator,
    Iterable,
    List,
    Mapping,
    Optional,
    Set,
    Tuple,
    Type,
    TypeVar,
    cast,
)

import mmh3
import sentry_sdk
from django import db
from django.db import OperationalError, connections, models, router, transaction
from django.db.models import Max, Min
from django.db.transaction import Atomic
from django.dispatch import Signal
from django.http import HttpRequest
from django.utils import timezone
from sentry_sdk.tracing import Span
from typing_extensions import Self

from sentry import options
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BaseModel,
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    JSONField,
    Model,
    control_silo_only_model,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.outboxes import HasControlReplicationHandlers, ReplicatedRegionModel
from sentry.db.postgres.transactions import enforce_constraints, in_test_assert_no_transaction
from sentry.services.hybrid_cloud import REGION_NAME_LENGTH
from sentry.silo import unguarded_write
from sentry.utils import metrics

THE_PAST = datetime.datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

_T = TypeVar("_T")
_M = TypeVar("_M", bound=BaseModel)


class OutboxFlushError(Exception):
    def __init__(self, message: str, outbox: OutboxBase) -> None:
        super().__init__(message)
        self.outbox = outbox


class InvalidOutboxError(Exception):
    pass


_outbox_categories_for_scope: Dict[int, Set[OutboxCategory]] = {}
_used_categories: Set[OutboxCategory] = set()


class OutboxCategory(IntEnum):
    USER_UPDATE = 0
    WEBHOOK_PROXY = 1
    ORGANIZATION_UPDATE = 2
    ORGANIZATION_MEMBER_UPDATE = 3
    UNUSED_TWO = 4
    AUDIT_LOG_EVENT = 5
    USER_IP_EVENT = 6
    INTEGRATION_UPDATE = 7
    PROJECT_UPDATE = 8
    API_APPLICATION_UPDATE = 9
    SENTRY_APP_INSTALLATION_UPDATE = 10
    TEAM_UPDATE = 11
    ORGANIZATION_INTEGRATION_UPDATE = 12
    UNUSUED_THREE = 13
    SEND_SIGNAL = 14
    ORGANIZATION_MAPPING_CUSTOMER_ID_UPDATE = 15
    ORGAUTHTOKEN_UPDATE = 16
    PROVISION_ORGANIZATION = 17
    POST_ORGANIZATION_PROVISION = 18
    UNUSED_ONE = 19
    DISABLE_AUTH_PROVIDER = 20
    RESET_IDP_FLAGS = 21
    MARK_INVALID_SSO = 22
    SUBSCRIPTION_UPDATE = 23

    AUTH_PROVIDER_UPDATE = 24
    AUTH_IDENTITY_UPDATE = 25
    ORGANIZATION_MEMBER_TEAM_UPDATE = 26
    ORGANIZATION_SLUG_RESERVATION_UPDATE = 27
    API_KEY_UPDATE = 28
    PARTNER_ACCOUNT_UPDATE = 29

    @classmethod
    def as_choices(cls):
        return [(i.value, i.value) for i in cls]

    def connect_region_model_updates(self, model: Type[ReplicatedRegionModel]) -> None:
        def receiver(
            object_identifier: int,
            payload: Optional[Mapping[str, Any]],
            shard_identifier: int,
            *args,
            **kwds,
        ):
            from sentry.receivers.outbox import maybe_process_tombstone

            maybe_instance: ReplicatedRegionModel | None = maybe_process_tombstone(
                cast(Any, model), object_identifier, region_name=None
            )
            if maybe_instance is None:
                model.handle_async_deletion(
                    identifier=object_identifier, shard_identifier=shard_identifier, payload=payload
                )
            else:
                maybe_instance.handle_async_replication(shard_identifier=shard_identifier)

        process_region_outbox.connect(receiver, weak=False, sender=self)

    def connect_control_model_updates(self, model: Type[HasControlReplicationHandlers]) -> None:
        def receiver(
            object_identifier: int,
            payload: Optional[Mapping[str, Any]],
            shard_identifier: int,
            region_name: str,
            *args,
            **kwds,
        ):
            from sentry.receivers.outbox import maybe_process_tombstone

            maybe_instance: HasControlReplicationHandlers | None = maybe_process_tombstone(
                cast(Any, model), object_identifier, region_name=region_name
            )
            if maybe_instance is None:
                model.handle_async_deletion(
                    identifier=object_identifier,
                    region_name=region_name,
                    shard_identifier=shard_identifier,
                    payload=payload,
                )
            else:
                maybe_instance.handle_async_replication(
                    shard_identifier=shard_identifier, region_name=region_name
                )

        process_control_outbox.connect(receiver, weak=False, sender=self)

    def get_scope(self) -> OutboxScope:
        for scope_int, categories in _outbox_categories_for_scope.items():
            if self not in categories:
                continue
            break
        else:
            raise KeyError
        return OutboxScope(scope_int)

    def as_region_outbox(
        self,
        model: Any | None = None,
        payload: Any | None = None,
        shard_identifier: int | None = None,
        object_identifier: int | None = None,
        outbox: Type[RegionOutboxBase] | None = None,
    ) -> RegionOutboxBase:
        scope = self.get_scope()

        shard_identifier, object_identifier = self.infer_identifiers(
            scope, model, object_identifier=object_identifier, shard_identifier=shard_identifier
        )

        Outbox = outbox or RegionOutbox

        return Outbox(
            shard_scope=scope,
            shard_identifier=shard_identifier,
            category=self,
            object_identifier=object_identifier,
            payload=payload,
        )

    def as_control_outboxes(
        self,
        region_names: Collection[str],
        model: Any | None = None,
        payload: Any | None = None,
        shard_identifier: int | None = None,
        object_identifier: int | None = None,
        outbox: Type[ControlOutboxBase] | None = None,
    ) -> List[ControlOutboxBase]:
        scope = self.get_scope()

        shard_identifier, object_identifier = self.infer_identifiers(
            scope, model, object_identifier=object_identifier, shard_identifier=shard_identifier
        )

        Outbox = outbox or ControlOutbox

        return [
            Outbox(
                shard_scope=scope,
                shard_identifier=shard_identifier,
                category=self,
                object_identifier=object_identifier,
                region_name=region_name,
                payload=payload,
            )
            for region_name in region_names
        ]

    def infer_identifiers(
        self,
        scope: OutboxScope,
        model: Optional[BaseModel],
        *,
        object_identifier: int | None,
        shard_identifier: int | None,
    ) -> Tuple[int, int]:
        from sentry.models.organization import Organization
        from sentry.models.user import User

        assert (model is not None) ^ (
            object_identifier is not None
        ), "Either model or object_identifier must be specified"

        if model is not None and hasattr(model, "id"):
            object_identifier = model.id

        if shard_identifier is None and model is not None:
            if scope == OutboxScope.ORGANIZATION_SCOPE:
                if isinstance(model, Organization):
                    shard_identifier = model.id
                elif hasattr(model, "organization_id"):
                    shard_identifier = model.organization_id
                elif hasattr(model, "auth_provider_id"):
                    shard_identifier = model.auth_provider_id
            if scope == OutboxScope.USER_SCOPE:
                if isinstance(model, User):
                    shard_identifier = model.id
                elif hasattr(model, "user_id"):
                    shard_identifier = model.user_id

        assert (
            model is not None
        ) or shard_identifier is not None, "Either model or shard_identifier must be specified"

        assert object_identifier is not None
        assert shard_identifier is not None
        return shard_identifier, object_identifier


def scope_categories(enum_value: int, categories: Set[OutboxCategory]) -> int:
    _outbox_categories_for_scope[enum_value] = categories
    inter = _used_categories.intersection(categories)
    assert not inter, f"OutboxCategories {inter} were already registered to a different scope"
    _used_categories.update(categories)
    return enum_value


class OutboxScope(IntEnum):
    ORGANIZATION_SCOPE = scope_categories(
        0,
        {
            OutboxCategory.ORGANIZATION_MEMBER_UPDATE,
            OutboxCategory.MARK_INVALID_SSO,
            OutboxCategory.RESET_IDP_FLAGS,
            OutboxCategory.ORGANIZATION_UPDATE,
            OutboxCategory.PROJECT_UPDATE,
            OutboxCategory.ORGANIZATION_INTEGRATION_UPDATE,
            OutboxCategory.SEND_SIGNAL,
            OutboxCategory.ORGAUTHTOKEN_UPDATE,
            OutboxCategory.POST_ORGANIZATION_PROVISION,
            OutboxCategory.DISABLE_AUTH_PROVIDER,
            OutboxCategory.ORGANIZATION_MAPPING_CUSTOMER_ID_UPDATE,
            OutboxCategory.TEAM_UPDATE,
            OutboxCategory.AUTH_PROVIDER_UPDATE,
            OutboxCategory.ORGANIZATION_MEMBER_TEAM_UPDATE,
            OutboxCategory.API_KEY_UPDATE,
            OutboxCategory.ORGANIZATION_SLUG_RESERVATION_UPDATE,
        },
    )
    USER_SCOPE = scope_categories(
        1,
        {
            OutboxCategory.USER_UPDATE,
            OutboxCategory.UNUSED_ONE,
            OutboxCategory.UNUSED_TWO,
            OutboxCategory.UNUSUED_THREE,
            OutboxCategory.AUTH_IDENTITY_UPDATE,
        },
    )
    WEBHOOK_SCOPE = scope_categories(2, {OutboxCategory.WEBHOOK_PROXY})
    AUDIT_LOG_SCOPE = scope_categories(3, {OutboxCategory.AUDIT_LOG_EVENT})
    USER_IP_SCOPE = scope_categories(
        4,
        {
            OutboxCategory.USER_IP_EVENT,
        },
    )
    INTEGRATION_SCOPE = scope_categories(
        5,
        {
            OutboxCategory.INTEGRATION_UPDATE,
        },
    )
    APP_SCOPE = scope_categories(
        6,
        {
            OutboxCategory.API_APPLICATION_UPDATE,
            OutboxCategory.SENTRY_APP_INSTALLATION_UPDATE,
        },
    )
    # Deprecate?
    TEAM_SCOPE = scope_categories(
        7,
        set(),
    )
    PROVISION_SCOPE = scope_categories(
        8,
        {
            OutboxCategory.PROVISION_ORGANIZATION,
            OutboxCategory.PARTNER_ACCOUNT_UPDATE,
        },
    )
    SUBSCRIPTION_SCOPE = scope_categories(9, {OutboxCategory.SUBSCRIPTION_UPDATE})

    def __str__(self):
        return self.name

    @classmethod
    def as_choices(cls):
        return [(i.value, i.value) for i in cls]

    @staticmethod
    def get_tag_name(scope: OutboxScope):
        if scope == OutboxScope.ORGANIZATION_SCOPE:
            return "organization_id"
        if scope == OutboxScope.USER_SCOPE:
            return "user_id"
        if scope == OutboxScope.APP_SCOPE:
            return "app_id"

        return "shard_identifier"


_missing_categories = set(OutboxCategory) - _used_categories
assert (
    not _missing_categories
), f"OutboxCategories {_missing_categories} not registered to an OutboxScope"


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
    LEGACY_PLUGIN = 10
    GETSENTRY = 11


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
    def find_scheduled_shards(cls, low: int = 0, hi: int | None = None) -> List[Mapping[str, Any]]:
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
        with transaction.atomic(using=using):
            next_outbox: OutboxBase | None
            next_outbox = cls(**row).selected_messages_in_shard().order_by("id").first()
            if not next_outbox:
                return None

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

    __relocation_scope__ = RelocationScope.Excluded

    # Different shard_scope, shard_identifier pairings of messages are always deliverable in parallel
    shard_scope = BoundedPositiveIntegerField(choices=OutboxScope.as_choices(), null=False)
    shard_identifier = BoundedBigIntegerField(null=False)

    # Objects of equal scope, shard_identifier, category, and object_identifier are coalesced in processing.
    category = BoundedPositiveIntegerField(choices=OutboxCategory.as_choices(), null=False)
    object_identifier = BoundedBigIntegerField(null=False)

    # payload is used for webhook payloads.
    payload: models.Field[dict[str, Any], dict[str, Any]] = JSONField(null=True)

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
        if OutboxCategory(self.category) not in _outbox_categories_for_scope[int(self.shard_scope)]:
            raise InvalidOutboxError(
                f"Outbox.category {self.category} not configured for scope {self.shard_scope}"
            )

        if _outbox_context.flushing_enabled:
            transaction.on_commit(lambda: self.drain_shard(), using=router.db_for_write(type(self)))

        tags = {"category": OutboxCategory(self.category).name}
        metrics.incr("outbox.saved", 1, tags=tags)
        super().save(**kwds)

    def lock_id(self, attrs: Iterable[str]) -> int:
        # 64 bit integer that roughly encodes a unique, serializable lock identifier
        return mmh3.hash64(".".join(str(getattr(self, attr)) for attr in attrs))[0]

    @contextlib.contextmanager
    def process_shard(
        self,
        latest_shard_row: OutboxBase | None,
        lock_timeout: int = 5,
    ) -> Generator[OutboxBase | None, None, None]:
        using: str = db.router.db_for_write(type(self))

        shard_lock_id = self.lock_id(self.sharding_columns)
        with connections[using].cursor() as cursor:
            cursor.execute("show lock_timeout")
            orig_timeout = cursor.fetchone()[0]
            cursor.execute(f"SET local lock_timeout='{lock_timeout}s'")

        try:
            next_shard_row: OutboxBase | None
            try:
                with metrics.timer("outbox.process_shard.acquire_lock"), connections[
                    using
                ].cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_lock(%s)", [shard_lock_id])
            except OperationalError as e:
                if latest_shard_row:
                    next_shard_row = self.selected_messages_in_shard(
                        latest_shard_row=latest_shard_row
                    ).first()

                    # If performing a synchronous flush, we have an expectation that writes up to the highest
                    # id seen since we started to flush has been processed.  If that is not the case in a high
                    # contention scenario, we should raise an exception to prevent breaking read after write invariance.
                    if next_shard_row is not None:
                        # TODO: Remove me -- once we get deployed past canary, we want these exceptions to block any
                        # contentions that is occurring to preserve the read after write invariance.
                        if options.get("hybrid_cloud.outbox_lock.raise_on_contention"):
                            raise OutboxFlushError(
                                f"Could not flush shard category={self.category}", self
                            ) from e
                yield None
                return
            except Exception as e:
                raise e

            next_shard_row = self.selected_messages_in_shard(
                latest_shard_row=latest_shard_row
            ).first()
            yield next_shard_row
        finally:
            try:
                with connections[using].cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_unlock(%s)", [shard_lock_id])
                    cursor.execute(f"SET lock_timeout='{orig_timeout}'")
            except Exception:
                # If something strange is going on with our connection, force it closed to prevent holding the lock.
                connections[using].close()
                raise

    @contextlib.contextmanager
    def process_coalesced(self) -> Generator[OutboxBase | None, None, None]:
        coalesced: OutboxBase | None = self.select_coalesced_messages().last()
        first_coalesced: OutboxBase | None = self.select_coalesced_messages().first() or coalesced
        tags = {"category": "None"}

        if coalesced is not None:
            tags["category"] = OutboxCategory(self.category).name
            assert first_coalesced, "first_coalesced incorrectly set for non-empty coalesce group"
            metrics.timing(
                "outbox.coalesced_net_queue_time",
                datetime.datetime.now(tz=datetime.timezone.utc).timestamp()
                - first_coalesced.date_added.timestamp(),
                tags=tags,
            )

        yield coalesced

        # If the context block didn't raise we mark messages as completed by deleting them.
        if coalesced is not None:
            assert first_coalesced, "first_coalesced incorrectly set for non-empty coalesce group"
            deleted_count, _ = (
                self.select_coalesced_messages().filter(id__lte=coalesced.id).delete()
            )

            metrics.incr("outbox.processed", deleted_count, tags=tags)
            metrics.timing(
                "outbox.processing_lag",
                datetime.datetime.now(tz=datetime.timezone.utc).timestamp()
                - first_coalesced.scheduled_from.timestamp(),
                tags=tags,
            )
            metrics.timing(
                "outbox.coalesced_net_processing_time",
                datetime.datetime.now(tz=datetime.timezone.utc).timestamp()
                - first_coalesced.date_added.timestamp(),
                tags=tags,
            )

    def _set_span_data_for_coalesced_message(self, span: Span, message: OutboxBase):
        tag_for_outbox = OutboxScope.get_tag_name(message.shard_scope)
        span.set_tag(tag_for_outbox, message.shard_identifier)
        span.set_data("payload", message.payload)
        span.set_data("outbox_id", message.id)
        span.set_tag("outbox_category", OutboxCategory(message.category).name)
        span.set_tag("outbox_scope", OutboxScope(message.shard_scope).name)

    def process(self) -> bool:
        with self.process_coalesced() as coalesced:
            if coalesced is not None:
                with metrics.timer(
                    "outbox.send_signal.duration",
                    tags={"category": OutboxCategory(coalesced.category).name},
                ), sentry_sdk.start_span(op="outbox.process") as span:
                    self._set_span_data_for_coalesced_message(span=span, message=coalesced)
                    try:
                        coalesced.send_signal()
                    except Exception as e:
                        raise OutboxFlushError(
                            f"Could not flush shard category={coalesced.category}", coalesced
                        ) from e

                return True
        return False

    @abc.abstractmethod
    def send_signal(self) -> None:
        pass

    def drain_shard(
        self, flush_all: bool = False, _test_processing_barrier: threading.Barrier | None = None
    ) -> None:
        # Do not waste too much time in flush_all case on a contentious lock.
        lock_timeout = 5 if not flush_all else 1

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
            with self.process_shard(latest_shard_row, lock_timeout=lock_timeout) as shard_row:
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

    __repr__ = sane_repr("payload", *coalesced_columns)


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

    __repr__ = sane_repr("payload", *coalesced_columns)

    @classmethod
    def get_webhook_payload_from_request(cls, request: HttpRequest) -> OutboxWebhookPayload:
        assert request.method is not None
        return OutboxWebhookPayload(
            method=request.method,
            path=request.get_full_path(),
            uri=request.build_absolute_uri(),
            headers={k: v for k, v in request.headers.items()},
            body=request.body.decode(encoding="utf-8"),
        )

    @classmethod
    def get_webhook_payload_from_outbox(cls, payload: Mapping[str, Any]) -> OutboxWebhookPayload:
        return OutboxWebhookPayload(
            method=payload["method"],
            path=payload["path"],
            uri=payload["uri"],
            headers=payload["headers"],
            body=payload["body"],
        )

    @classmethod
    def for_webhook_update(
        cls,
        *,
        webhook_identifier: WebhookProviderIdentifier,
        region_names: List[str],
        request: HttpRequest,
    ) -> Iterable[Self]:
        for region_name in region_names:
            result = cls()
            result.shard_scope = OutboxScope.WEBHOOK_SCOPE
            result.shard_identifier = webhook_identifier.value
            result.object_identifier = cls.next_object_identifier()
            result.category = OutboxCategory.WEBHOOK_PROXY
            result.region_name = region_name
            payload = result.get_webhook_payload_from_request(request)
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


class OutboxContext(threading.local):
    flushing_enabled: bool | None = None


_outbox_context = OutboxContext()


@contextlib.contextmanager
def outbox_context(
    inner: Atomic | None = None, flush: bool | None = None
) -> Generator[Atomic | None, None, None]:
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


process_region_outbox = Signal()  # ["payload", "object_identifier"]
process_control_outbox = Signal()  # ["payload", "region_name", "object_identifier"]
