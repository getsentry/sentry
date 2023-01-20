from __future__ import annotations

import random
import sys
from typing import Any, Protocol, Type, TypeVar

from django.dispatch import receiver

from sentry import options
from sentry.models import (
    Organization,
    OrganizationMember,
    OutboxBase,
    OutboxCategory,
    User,
    process_region_outbox,
)
from sentry.services.hybrid_cloud.organization_mapping import (
    ApiOrganizationMappingUpdate,
    organization_mapping_service,
)
from sentry.services.hybrid_cloud.tombstone import ApiTombstone, tombstone_service


def maybe_write_outbox(outbox: OutboxBase):
    if random.random() < float(options.get("hybrid_cloud.outbox_rate")) or "pytest" in sys.modules:
        outbox.save()


class ModelLike(Protocol):
    objects: Any


T = TypeVar("T", bound=ModelLike)


def _maybe_process_tombstone(model: Type[T], object_identifier: int) -> T | None:
    if instance := model.objects.filter(id=object_identifier).last():
        return instance

    tombstone_service.record_remote_tombstone(
        ApiTombstone(table_name=model._meta.db_table, identifier=object_identifier)
    )
    return None


@receiver(process_region_outbox, sender=OutboxCategory.USER_UPDATE)
def process_user_updates(object_identifier: int, **kwds: Any):
    if (user := _maybe_process_tombstone(User, object_identifier)) is None:
        return
    user  # Currently we do not sync any other user changes, but if we did, you can use this variable.


@receiver(process_region_outbox, sender=OutboxCategory.ORGANIZATION_UPDATE)
def process_organization_updates(object_identifier: int, **kwds: Any):
    if (org := _maybe_process_tombstone(Organization, object_identifier)) is None:
        return

    update = ApiOrganizationMappingUpdate.from_instance(org)
    organization_mapping_service.update(update)


@receiver(process_region_outbox, sender=OutboxCategory.ORGANIZATION_MEMBER_UPDATE)
def process_organization_member_updates(object_identifier: int, **kwds: Any):
    if (org_member := _maybe_process_tombstone(OrganizationMember, object_identifier)) is None:
        return
    org_member  # TODO: When we get the org member mapping table in place, here is where we'll sync it.


@receiver(process_region_outbox, sender=OutboxCategory.VERIFY_ORGANIZATION_MAPPING)
def process_organization_mapping_verifications(object_identifier: int, **kwds: Any):
    if (org := _maybe_process_tombstone(Organization, object_identifier)) is None:
        return

    organization_mapping_service.verify_mappings(org.id, org.slug)
