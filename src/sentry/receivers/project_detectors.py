import logging

import sentry_sdk
from django.db.models.signals import post_save

from sentry import features
from sentry.models.project import Project
from sentry.workflow_engine.processors.detector import (
    UnableToAcquireLockApiError,
    ensure_default_detectors,
)

logger = logging.getLogger(__name__)


def create_project_detectors(instance, created, **kwargs):
    if created:
        try:
            if features.has(
                "organizations:workflow-engine-issue-alert-dual-write", instance.organization
            ):
                ensure_default_detectors(instance)
        except UnableToAcquireLockApiError as e:
            sentry_sdk.capture_exception(e)


post_save.connect(
    create_project_detectors, sender=Project, dispatch_uid="create_project_detectors", weak=False
)
