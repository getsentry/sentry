from __future__ import annotations

import abc
import contextlib
import datetime
import sys
from enum import IntEnum
from typing import Any, Iterable, List, Mapping, Set, TypeVar

from django.db import connections, models, router, transaction
from django.db.models import Max
from django.dispatch import Signal
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    JSONField,
    Model,
    sane_repr,
)
from sentry.silo import SiloMode

THE_PAST = datetime.datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=timezone.utc)


class OutboxScope(IntEnum):
    ORGANIZATION_SCOPE = 0
    USER_SCOPE = 1
    WEBHOOK_SCOPE = 2

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

    @classmethod
    def as_choices(cls):
        return [(i.value, i.value) for i in cls]


class WebhookProviderIdentifier(IntEnum):
    SLACK = 0


T = TypeVar("T")


def _ensure_not_null(k: str, v: T) -> T:
    if v is None:
        raise ValueError(f"Attribute {k} was None, but it needed to be set!")
    return v


class OutboxBase(Model):
    sharding_columns: Iterable[str]
    coalesced_columns: Iterable[str]

    @classmethod
    def _unique_object_identifier(cls):
        with connections[router.db_for_write(cls)].cursor() as cursor:
            cursor.execute("SELECT nextval(%s);", [OBJECT_IDENTIFIER_SEQUENCE_NAME])
            return cursor.fetchone()[0]

    @classmethod
    def find_scheduled_shards(cls) -> Iterable[Mapping[str, Any]]:
        return (
            cls.objects.filter(scheduled_for__lte=timezone.now())
            .values(*cls.sharding_columns)
            .annotate(scheduled_for=Max("scheduled_for"))
            .order_by("scheduled_for")
        )

    @classmethod
    def prepare_next_from_shard(cls, row: Mapping[str, Any]) -> OutboxBase | None:
        with transaction.atomic(savepoint=False):
            next_outbox: OutboxBase | None
            next_outbox = (
                cls(**row).select_sharded_objects().order_by("id").select_for_update().first()
            )
            if not next_outbox:
                return None

            # Reschedule in case processing fails
            next_outbox.select_sharded_objects().update(
                scheduled_for=next_outbox.next_schedule(), scheduled_from=timezone.now()
            )

            return next_outbox

    def key_from(self, attrs: Iterable[str]) -> Mapping[str, Any]:
        return {k: _ensure_not_null(k, getattr(self, k)) for k in attrs}

    def select_sharded_objects(self) -> models.QuerySet:
        return self.objects.filter(**self.key_from(self.sharding_columns))

    def select_coalesced_objects(self) -> models.QuerySet:
        return self.objects.filter(**self.key_from(self.coalesced_columns))

    class Meta:
        abstract = True

    __include_in_export__ = False

    # Different scope, scope_identifier pairings of messages are always deliverable in parallel
    scope = BoundedPositiveIntegerField(choices=OutboxScope.as_choices(), null=False)
    scope_identifier = BoundedBigIntegerField(null=False)

    # Objects of equal scope, scope_identifier, category, and object_identifier are coalesced in processing.
    category = BoundedPositiveIntegerField(choices=OutboxCategory.as_choices(), null=False)
    object_identifier = BoundedBigIntegerField(null=False)

    # payload is used for webhook payloads.
    payload = JSONField(null=True)

    # The point at which this object was scheduled, used as a diff from scheduled_for to determine the intended delay.
    scheduled_from = models.DateTimeField(null=False, default=timezone.now)
    # The point at which this object is intended to be replicated, used for backoff purposes.  Keep in mind that
    # the largest back off effectively applies to the entire 'shard' key.
    scheduled_for = models.DateTimeField(null=False, default=THE_PAST)

    def duration(self) -> datetime.timedelta:
        return max(self.scheduled_for - self.scheduled_from, datetime.timedelta(seconds=1))

    def next_schedule(self) -> datetime.datetime:
        return timezone.now() + (self.duration() * 2)

    @contextlib.contextmanager
    def process_serialized(self):
        with transaction.atomic(savepoint=False):
            coalesced: OutboxBase = self.select_coalesced_objects().select_for_update().last()
            yield coalesced
            if coalesced is not None:
                self.select_coalesced_objects().delete()

    def process(self) -> bool:
        with self.process_serialized() as coalesced:
            if coalesced is not None:
                coalesced.send_signal()
                return True
        return False

    @abc.abstractmethod
    def send_signal(self):
        pass

    def drain_shard(self, max_updates_to_drain: int | None = 1) -> bool:
        runs = 0
        while max_updates_to_drain is None or runs < max_updates_to_drain:
            runs += 1
            next_row: OutboxBase = self.select_sharded_objects().first()
            if next_row is None:
                return True
            next_row.process()

        return self.select_sharded_objects().first() is not None


OBJECT_IDENTIFIER_SEQUENCE_NAME = "sentry_outbox_object_identifier_seq"
MONOLITH_REGION_NAME = "--monolith--"


# Outboxes bound from region silo -> control silo
class RegionOutbox(OutboxBase):
    def send_signal(self):
        process_region_outbox.send(
            sender=self.category, payload=self.payload, object_identifier=self.object_identifier
        )

    sharding_columns = ("scope", "scope_identifier")
    coalesced_columns = ("scope", "scope_identifier", "category", "object_identifier")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_regionoutbox"
        index_together = (
            (
                "scope",
                "scope_identifier",
                "category",
                "object_identifier",
            ),
            (
                "scope",
                "scope_identifier",
                "scheduled_for",
            ),
            ("scope", "scope_identifier", "id"),
        )

    __repr__ = sane_repr("scope", "scope_identifier", "category", "object_identifier")

    @classmethod
    def drain_for_model(cls, model_inst: Any, max_updates_to_drain: int | None = 1) -> bool:
        outbox = cls.for_model_update(model_inst)
        if outbox is None:
            return False
        return outbox.drain_shard(max_updates_to_drain)

    @classmethod
    def for_model_update(cls, model_inst: Any) -> RegionOutbox:
        from sentry.models import Organization, OrganizationMember

        result = cls()
        if isinstance(model_inst, Organization):
            result.scope = OutboxScope.ORGANIZATION_SCOPE
            result.scope_identifier = model_inst.id
            result.category = OutboxCategory.ORGANIZATION_UPDATE
            result.object_identifier = model_inst.id
        elif isinstance(model_inst, OrganizationMember):
            result.scope = OutboxScope.ORGANIZATION_SCOPE
            result.scope_identifier = model_inst.organization_id
            result.category = OutboxCategory.ORGANIZATION_MEMBER_UPDATE
            result.object_identifier = model_inst.id
        else:
            raise ValueError(f"{model_inst!r} isn't supported for region silo model update!")
        return result


# Outboxes bound from region silo -> control silo
class ControlOutbox(OutboxBase):
    sharding_columns = ("region_name", "scope", "scope_identifier")
    coalesced_columns = (
        "region_name",
        "scope",
        "scope_identifier",
        "category",
        "object_identifier",
    )

    region_name = models.CharField(max_length=48)

    def send_signal(self):
        process_control_outbox.send(
            sender=self.category,
            payload=self.payload,
            region_name=self.region_name,
            object_identifier=self.object_identifier,
        )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_controloutbox"
        index_together = (
            (
                "region_name",
                "scope",
                "scope_identifier",
                "category",
                "object_identifier",
            ),
            (
                "region_name",
                "scope",
                "scope_identifier",
                "scheduled_for",
            ),
            ("region_name", "scope", "scope_identifier", "id"),
        )

    __repr__ = sane_repr(
        "region_name", "scope", "scope_identifier", "category", "object_identifier"
    )

    @classmethod
    def for_model_update(cls, model_inst: Any) -> Iterable[ControlOutbox]:
        from sentry.models import User

        if isinstance(model_inst, User):
            for region_name in _find_regions_for_user(model_inst.id):
                result = cls()
                result.scope = OutboxScope.USER_SCOPE
                result.object_identifier = model_inst.id
                result.scope_identifier = model_inst.id
                result.category = OutboxCategory.USER_UPDATE
                result.region_name = region_name
                yield result
        else:
            raise ValueError(f"{model_inst!r} isn't supported for control silo model update!")

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
            result.scope = OutboxScope.WEBHOOK_SCOPE
            result.scope_identifier = webhook_identifier.value
            result.object_identifier = cls._unique_object_identifier()
            result.category = OutboxCategory.WEBHOOK_PROXY
            result.region_name = region_name
            result.payload = payload
            yield result


def _find_orgs_for_user(user_id: int) -> Set[int]:
    # TODO: This must be changed to the org member mapping in the control silo eventually.
    from sentry.models import OrganizationMember

    return {
        m[0] for m in OrganizationMember.objects.filter(user_id=user_id).values("organization_id")
    }


def _find_regions_for_user(user_id: int) -> Set[str]:
    from sentry.models import OrganizationMapping

    org_ids: Set[int]
    if "pytest" in sys.modules:
        from sentry.testutils.silo import exempt_from_silo_limits

        with exempt_from_silo_limits():
            org_ids = _find_orgs_for_user(user_id)
    else:
        org_ids = _find_orgs_for_user(user_id)

    if SiloMode.get_current_mode() == SiloMode.MONOLITH:
        return {
            MONOLITH_REGION_NAME,
        }
    else:
        return {
            t[0]
            for t in OrganizationMapping.objects.filter(organization_id__in=org_ids).values(
                "region_name"
            )
        }


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
