import sys
from enum import IntEnum
from typing import Any, Iterable, List, Mapping, Set, TypeVar

from django.db import models

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    JSONField,
    Model,
    sane_repr,
)
from sentry.models import OrganizationMapping
from sentry.silo import SiloMode


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
    WEBHOOK_PAYLOAD = 1

    @classmethod
    def as_choices(cls):
        return [(i.value, i.value) for i in cls]


T = TypeVar("T")


def _ensure_not_null(k: str, v: T) -> T:
    if v is None:
        raise ValueError(f"Attribute {k} was None, but it needed to be set!")
    return v


class OutboxBase(Model):
    sharding_index: Iterable[str]

    def coalesced_key(self) -> Mapping[str, Any]:
        return {
            k: _ensure_not_null(getattr(self, k))
            for k in list(self.sharding_index) + ["category", "object_identifier"]
        }

    def select_coalesced_objects(self) -> models.QuerySet:
        return self.objects.filter(**self.coalesced_key())

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

    # Tracks the back off state in failure modes.
    last_attempt_duration = models.DurationField(null=True)


OBJECT_IDENTIFIER_SEQUENCE_NAME = "sentry_outbox_object_identifier_seq"
MONOLITH_REGION_NAME = "--monolith--"


# Outboxes bound from region silo -> control silo
class RegionOutbox(OutboxBase):
    sharding_index = ("scope", "scope_identifier")

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
        )

    __repr__ = sane_repr("scope", "scope_identifier", "category", "object_identifier")

    @classmethod
    def for_model_update(cls, model_inst: Any) -> "RegionOutbox":
        result = cls()
        return result

    MANAGED_DELETES: List[type] = []


# Outboxes bound from region silo -> control silo
class ControlOutbox(OutboxBase):
    sharding_index = ("region_name", "scope", "scope_identifier")
    region_name = models.CharField(max_length=48)

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
        )

    __repr__ = sane_repr(
        "region_name", "scope", "scope_identifier", "category", "object_identifier"
    )

    @classmethod
    def for_model_update(cls, model_inst: Any) -> Iterable["ControlOutbox"]:
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


def _find_orgs_for_user(user_id: int) -> Set[int]:
    # TODO: This must be changed to the org member mapping in the control silo eventually.
    from sentry.models import OrganizationMember

    return {
        m[0] for m in OrganizationMember.objects.filter(user_id=user_id).values("organization_id")
    }


def _find_regions_for_user(user_id: int) -> Set[str]:
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
