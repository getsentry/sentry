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
from sentry.db.postgres.transactions import (
    django_test_transaction_water_mark,
    enforce_constraints,
    in_test_assert_no_transaction,
)
from sentry.services.hybrid_cloud import REGION_NAME_LENGTH
from sentry.silo import SiloMode, unguarded_write
from sentry.utils import metrics

THE_PAST = datetime.datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)

_T = TypeVar("_T")


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
    ORGAUTHTOKEN_UPDATE_USED = 16
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
    SENTRY_APP_UPDATE = 30
    ACTOR_UPDATE = 31
    API_TOKEN_UPDATE = 32
    ORG_AUTH_TOKEN_UPDATE = 33
    ISSUE_COMMENT_UPDATE = 34
    EXTERNAL_ACTOR_UPDATE = 35

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
        from sentry.models.apiapplication import ApiApplication
        from sentry.models.integrations import Integration
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
                elif hasattr(model, "auth_provider"):
                    shard_identifier = model.auth_provider.organization_id
            if scope == OutboxScope.USER_SCOPE:
                if isinstance(model, User):
                    shard_identifier = model.id
                elif hasattr(model, "user_id"):
                    shard_identifier = model.user_id
            if scope == OutboxScope.APP_SCOPE:
                if isinstance(model, ApiApplication):
                    shard_identifier = model.id
                elif hasattr(model, "api_application_id"):
                    shard_identifier = model.api_application_id
            if scope == OutboxScope.INTEGRATION_SCOPE:
                if isinstance(model, Integration):
                    shard_identifier = model.id
                elif hasattr(model, "integration_id"):
                    shard_identifier = model.integration_id

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
            OutboxCategory.ORGAUTHTOKEN_UPDATE_USED,
            OutboxCategory.POST_ORGANIZATION_PROVISION,
            OutboxCategory.DISABLE_AUTH_PROVIDER,
            OutboxCategory.ORGANIZATION_MAPPING_CUSTOMER_ID_UPDATE,
            OutboxCategory.TEAM_UPDATE,
            OutboxCategory.AUTH_PROVIDER_UPDATE,
            OutboxCategory.ORGANIZATION_MEMBER_TEAM_UPDATE,
            OutboxCategory.API_KEY_UPDATE,
            OutboxCategory.ORGANIZATION_SLUG_RESERVATION_UPDATE,
            OutboxCategory.ORG_AUTH_TOKEN_UPDATE,
            OutboxCategory.PARTNER_ACCOUNT_UPDATE,
            OutboxCategory.ACTOR_UPDATE,
            OutboxCategory.ISSUE_COMMENT_UPDATE,
        },
    )
    USER_SCOPE = scope_categories(
        1,
        {
            OutboxCategory.USER_UPDATE,
            OutboxCategory.API_TOKEN_UPDATE,
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
        {OutboxCategory.INTEGRATION_UPDATE, OutboxCategory.EXTERNAL_ACTOR_UPDATE},
    )
    APP_SCOPE = scope_categories(
        6,
        {
            OutboxCategory.API_APPLICATION_UPDATE,
            OutboxCategory.SENTRY_APP_INSTALLATION_UPDATE,
            OutboxCategory.SENTRY_APP_UPDATE,
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
    DISCORD = 12
    VERCEL = 13


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
                f"Outbox.category {self.category} ({OutboxCategory(self.category).name}) not configured for scope {self.shard_scope} ({OutboxScope(self.shard_scope).name})"
            )

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
    def process_coalesced(
        self, is_synchronous_flush: bool
    ) -> Generator[OutboxBase | None, None, None]:
        coalesced: OutboxBase | None = self.select_coalesced_messages().last()
        first_coalesced: OutboxBase | None = self.select_coalesced_messages().first() or coalesced
        tags: dict[str, int | str] = {"category": "None", "synchronous": int(is_synchronous_flush)}

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

    def process(self, is_synchronous_flush: bool) -> bool:
        with self.process_coalesced(is_synchronous_flush=is_synchronous_flush) as coalesced:
            if coalesced is not None:
                with metrics.timer(
                    "outbox.send_signal.duration",
                    tags={
                        "category": OutboxCategory(coalesced.category).name,
                        "synchronous": int(is_synchronous_flush),
                    },
                ), sentry_sdk.start_span(op="outbox.process") as span:
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

                shard_row.process(is_synchronous_flush=not flush_all)

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


# Add this in after we successfully deploy, the job.
# @receiver(post_migrate, weak=False, dispatch_uid="schedule_backfill_outboxes")
# def schedule_backfill_outboxes(app_config, using, **kwargs):
#     from sentry.tasks.backfill_outboxes import (
#         schedule_backfill_outbox_jobs,
#         schedule_backfill_outbox_jobs_control,
#     )
#     from sentry.utils.env import in_test_environment
#
#     if in_test_environment():
#         return
#
#     if SiloMode.get_current_mode() != SiloMode.REGION:
#         schedule_backfill_outbox_jobs_control.delay()
#     if SiloMode.get_current_mode() != SiloMode.CONTROL:
#         schedule_backfill_outbox_jobs.delay()
