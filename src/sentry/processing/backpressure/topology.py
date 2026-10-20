from enum import Enum

"""
This defines the "topology" of our services.

In other words, which service (consumer) depends on which other services (queues, stores, locks).
"""


class ProcessingServices(Enum):
    AttachmentsStore = "attachments-store"
    ProcessingLocks = "processing-locks"
    PostProcessLocks = "post-process-locks"


def get_all_services() -> list[str]:
    return [item.value for item in ProcessingServices]


CONSUMERS = {
    # fallback if no explicit consumer was defined
    "default": get_all_services(),
    "profiles": [],
    # Transactions have been split into their own consumer here,
    # We should consider this for our other consumer types.
    # For example, `ingest-events` does not depend on `attachments-store`.
    "ingest": [
        ProcessingServices.AttachmentsStore.value,
        ProcessingServices.ProcessingLocks.value,
        ProcessingServices.PostProcessLocks.value,
    ],
    "ingest-transactions": [
        ProcessingServices.ProcessingLocks.value,
        ProcessingServices.PostProcessLocks.value,
    ],
}
