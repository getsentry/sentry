"""
Outbox messages are how we propagate state changes between Silos

Region & Control Silos can publish outbox messages which are propagated asynchronously to
the 'other' silo. This means that outbox messages created on a Region Silo are pushed to
the Control Silo, and outbox messages created on the Control Silo are pushed to relevant Region Silos.

Messages are considered relevant to a Region Silo if there is a chance that a region has
a record that relies on the outbox message. Often this boils down to relations to organizations
or users. However, SentryApps and ApiApplications are special.

### Message Types & Directionality

Within the outbox functionality there are two outbox models:

- `RegionOutbox` is for messages made in a Region that need to be delivered to Control Silo
- `ControlOutbox` is for messages made in Control Silo that need to be propagated to Region Silos.

### Saving outbox messages

When ORM models have changes made that need to be propagated to the 'other' silo(s)
you must use a database transaction to perform the side-effect and outbox messages.
Doing both in a single database transactions ensures that outbox messages are only
persisted alongside the change that as persisted.

ex.

```python
# Within Organization.delete()
with transaction.atomic():
    Organization.outbox_for_update(self.id).save()
    return super().delete(**kwargs)
```

### Outbox message processing

Outbox messages are delivered periodically (each minute) by the `sentry.tasks.enqueue_outbox_jobs`.
This task runs in both Control and Region Silos and triggers the `send_signal()` method on outbox
model records.

Attached signal handlers are triggered in the region that the outbox message was generated in.
Signal handlers are responsible for doing any local changes (recording tombstones) and sending RPC
calls to update state on the other region.

Should the signal handler raise an error for any reason, it will remain in the outbox until it can
be successfully delivered.

See https://www.notion.so/sentry/Async-cross-region-updates-outbox-9330293c8d2f4bd497361a505fd355d3
"""

from __future__ import annotations

from typing import TypeVar

from sentry.db.models import Model
from sentry.hybridcloud.services.tombstone import (
    RpcTombstone,
    control_tombstone_service,
    region_tombstone_service,
)
from sentry.silo.base import SiloMode

T = TypeVar("T", bound=Model)


def maybe_process_tombstone(
    model: type[T], object_identifier: int, region_name: str | None = None
) -> T | None:
    if instance := model.objects.filter(id=object_identifier).last():
        return instance

    tombstone = RpcTombstone(table_name=model._meta.db_table, identifier=object_identifier)
    # tombstones sent from control must have a region name, and monolith needs to provide a region_name
    if region_name or SiloMode.get_current_mode() == SiloMode.CONTROL:
        region_tombstone_service.record_remote_tombstone(
            region_name=region_name, tombstone=tombstone
        )
    else:
        control_tombstone_service.record_remote_tombstone(tombstone=tombstone)
    return None
