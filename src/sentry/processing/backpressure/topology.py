from enum import Enum

"""
This defines the "topology" of our services.

In other words, which service (consumer) depends on which other services (queues, processing store).
"""


class ProcessingServices(Enum):
    Celery = "celery"
    AttachmentsStore = "attachments-store"
    ProcessingStore = "processing-store"
    ProcessingStoreTransactions = "processing-store-transactions"
    ProcessingLocks = "processing-locks"
    PostProcessLocks = "post-process-locks"


def get_all_services() -> list[str]:
    return [item.value for item in ProcessingServices]


CONSUMERS = {
    # fallback if no explicit consumer was defined
    "default": get_all_services(),
    "profiles": [ProcessingServices.Celery.value],
    # Transactions have been split into their own consumer here,
    # We should consider this for our other consumer types.
    # For example, `ingest-events` does not depend on `attachments-store`.
    "ingest": [
        ProcessingServices.Celery.value,
        ProcessingServices.AttachmentsStore.value,
        ProcessingServices.ProcessingStore.value,
        ProcessingServices.ProcessingLocks.value,
        ProcessingServices.PostProcessLocks.value,
    ],
    "ingest-transactions": [
        ProcessingServices.Celery.value,
        ProcessingServices.ProcessingStoreTransactions.value,
        ProcessingServices.ProcessingLocks.value,
        ProcessingServices.PostProcessLocks.value,
    ],
}
