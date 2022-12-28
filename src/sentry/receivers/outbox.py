from __future__ import annotations

from typing import Any, Callable, List, Mapping

from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from sentry.models import (
    ControlOutbox,
    Organization,
    OrganizationMember,
    OutboxBase,
    OutboxCategory,
    RegionOutbox,
    User,
    outbox_silo_modes,
    process_region_outbox,
)
from sentry.services.hybrid_cloud.organization_mapping import (
    ApiOrganizationMappingUpdate,
    organization_mapping_service,
)
from sentry.services.hybrid_cloud.tombstone import ApiTombstone, tombstone_service
from sentry.silo import SiloMode


# This method is split out for test mocking convenience, and for future potential logging / metrics
def _prepare_outbox(outbox: OutboxBase):
    outbox.save()


def add_to_region_outbox(instance: Any):
    _prepare_outbox(RegionOutbox.for_model_update(instance))


def add_to_control_outbox(instance: Any):
    for outbox in ControlOutbox.for_model_update(instance):
        _prepare_outbox(outbox)


@receiver(post_save)
@receiver(pre_delete)
def process_outbox(instance: Any, signal: Any, **kwargs: Any):
    for silo_mode in outbox_silo_modes():
        if signal is pre_delete:
            if type(instance) not in outbox_managed_deletes.get(silo_mode, []):
                continue

        if signal is post_save:
            if kwargs.get("created", False):
                if type(instance) not in outbox_managed_creates.get(silo_mode, []):
                    continue
            else:
                if type(instance) not in outbox_managed_updates.get(silo_mode, []):
                    continue

        processor: Callable[[Any], None] = (
            add_to_control_outbox if silo_mode == SiloMode.CONTROL else add_to_region_outbox
        )

        processor(instance)


def _ensure_silo_matches(mapping: Mapping[SiloMode, List[type]]) -> Mapping[SiloMode, List[type]]:
    for silo_mode, types in mapping.items():
        for cls in types:
            if silo_mode not in getattr(cls, "_meta").silo_limit.modes:
                raise ValueError(
                    f"Expecting outbox to handle model {cls!r} in mode {silo_mode!r}, but it is not decorated to allow that."
                )

    return mapping


# IMPORTANT NOTE!  Managing model updates or deletes with the outbox pattern is very important for keeping necessary
# replication synchronization between silos, but it absolutely introduces a performance overhead! Think very careful
# about the throughput of each event before adding a model to either of these processes.

# Handles deletes, but not necessarily anything else.
outbox_managed_deletes = _ensure_silo_matches(
    {
        SiloMode.CONTROL: [User],
        SiloMode.REGION: [Organization, OrganizationMember],
    }
)

# Covers updates
outbox_managed_updates = _ensure_silo_matches(
    {
        SiloMode.REGION: [Organization],
    }
)

# Specifically handles create, but not updates.  It assumes that the mapping of user <-> org doesn't change
# after the fact for a given org member object.
outbox_managed_creates = _ensure_silo_matches(
    {
        SiloMode.REGION: [OrganizationMember, Organization],
    }
)


def _maybe_process_tombstone(model: Any, object_identifier: int) -> Any | None:
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
