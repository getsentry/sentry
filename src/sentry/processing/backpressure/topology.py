"""
This defines the "topology" of our services.

In other words, which service (consumer) depends on which other services (queues, processing store).
"""

PROCESSING_SERVICES = [
    "celery",
    "attachments-store",
    "processing-store",
    "processing-locks",
    "post-process-locks",
]

CONSUMERS = {
    # fallback if no explicit consumer was defined
    "default": PROCESSING_SERVICES,
    "profiles": ["celery"],
    # We might want to eventually make this more fine-grained for different consumer types.
    # For example, normal `ingest-events` does not depend on `attachments-store`.
    "ingest": PROCESSING_SERVICES,
}
