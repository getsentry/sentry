from typing import Any, Callable, List, Mapping

from django.db.models.signals import post_delete, post_save

from sentry.models import (
    ControlOutbox,
    Organization,
    OrganizationMember,
    OutboxBase,
    RegionOutbox,
    User,
    outbox_silo_modes,
)
from sentry.silo import SiloMode


def _prepare_outbox(outbox: OutboxBase):
    # Spare making multiple writes to the same coalesced object.
    if outbox.select_coalesced_objects().select_for_update().exists():
        return
    outbox.save()


def process_outbox_region_model(instance: Any):
    _prepare_outbox(RegionOutbox.for_model_update(instance))


def process_outbox_control_model(instance: Any):
    for outbox in ControlOutbox.for_model_update(instance):
        _prepare_outbox(outbox)


def process_outbox(instance: Any, signal: Any, **kwargs: Any):
    for silo_mode in outbox_silo_modes():
        if signal is post_delete:
            if type(instance) not in outbox_managed_deletes.get(silo_mode, []):
                return

        if signal is post_delete:
            if kwargs.get("created", False):
                if type(instance) not in outbox_managed_creates.get(silo_mode, []):
                    return
            else:
                if type(instance) not in outbox_managed_updates.get(silo_mode, []):
                    return

        processor: Callable[[Any], None] = (
            process_outbox_control_model
            if silo_mode == SiloMode.CONTROL
            else process_outbox_region_model
        )

        processor(instance)


def ensure_matches_silo(cls: type, silo_mode: SiloMode):
    if silo_mode not in getattr(cls, "_meta").silo_limit.modes:
        raise ValueError(
            f"Expecting outbox to handle model {cls!r} in mode {silo_mode!r}, but it is not decorated to allow that."
        )


# IMPORTANT NOTE!  Managing model updates or deletes with the outbox pattern is very important for keeping necessary
# replication synchronization between silos, but it absolutely introduces a performance overhead! Think very careful
# about the throughput of each event before adding a model to either of these processes.

# Handles deletes, but not necessarily anything else.
outbox_managed_deletes: Mapping[SiloMode, List[type]] = {
    SiloMode.CONTROL: [User],
    SiloMode.REGION: [Organization, OrganizationMember],
}

# Covers updates
outbox_managed_updates: Mapping[SiloMode, List[type]] = {
    SiloMode.REGION: [Organization],
}

# Specifically handles create, but not updates.  It assumes that the mapping of user <-> org doesn't change
# after the fact for a given org member object.
outbox_managed_creates: Mapping[SiloMode, List[type]] = {
    SiloMode.REGION: [OrganizationMember],
}

post_save.connect(process_outbox)
post_delete.connect(process_outbox)
