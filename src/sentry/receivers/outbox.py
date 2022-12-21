from typing import Any, Callable, List, Mapping

from django.db.models.signals import post_delete, post_save
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
@receiver(post_delete)
def process_outbox(instance: Any, signal: Any, **kwargs: Any):
    for silo_mode in outbox_silo_modes():
        if signal is post_delete:
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
        SiloMode.REGION: [OrganizationMember],
    }
)


@receiver(process_region_outbox, sender=OutboxCategory.USER_UPDATE)
def process_user_updates(object_identifier: int, **kwds: Any):
    try:
        User.objects.get(id=object_identifier)
    except User.DoesNotExist:
        # Send tombstone!
        pass
