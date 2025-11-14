from typing import int
import logging
from contextlib import contextmanager

import sentry_sdk
from django.db.models.signals import post_save

from sentry.models.project import Project
from sentry.workflow_engine.processors.detector import (
    UnableToAcquireLockApiError,
    ensure_default_detectors,
)

logger = logging.getLogger(__name__)


@contextmanager
def disable_default_detector_creation():
    """
    Context manager that temporarily disconnects the create_project_detectors
    signal handler, preventing default detectors from being created when a
    project is saved.
    """
    # Disconnect the signal
    post_save.disconnect(
        create_project_detectors, sender=Project, dispatch_uid="create_project_detectors"
    )
    try:
        yield
    finally:
        # Always reconnect the signal, even if an exception occurred
        post_save.connect(
            create_project_detectors,
            sender=Project,
            dispatch_uid="create_project_detectors",
            weak=False,
        )


def create_project_detectors(instance, created, **kwargs):
    if created:
        try:
            ensure_default_detectors(instance)
        except UnableToAcquireLockApiError as e:
            sentry_sdk.capture_exception(e)


post_save.connect(
    create_project_detectors, sender=Project, dispatch_uid="create_project_detectors", weak=False
)
