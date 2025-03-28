from sentry.taskworker.registry import taskregistry

deletiontasks = taskregistry.create_namespace(
    "deletions",
    # Deletions can take several minutes, so we have a long processing deadline.
    processing_deadline_duration=60 * 3,
)

deletioncontroltasks = taskregistry.create_namespace(
    "deletions.control",
    # Deletions can take several minutes, so we have a long processing deadline.
    processing_deadline_duration=60 * 3,
)
