import logging
from contextlib import contextmanager

import sentry_sdk
from django.db.models.signals import post_save

from sentry import features
from sentry.models.project import Project
from sentry.signals import project_created
from sentry.workflow_engine.processors.detector import (
    UnableToAcquireLockApiError,
    _ensure_metric_detector,
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


def create_metric_detector_with_owner(project: Project, user=None, user_id=None, **kwargs):
    """
    Creates default metric detector when project is created, with the team as owner.
    This listens to project_created signal which provides user information.
    """

    owner_team = project.teams.first()

    if not features.has("organizations:default-anomaly-detector", project.organization, actor=user):
        return

    if owner_team is None:
        logger.info(
            "create_metric_detector_with_owner.no_team",
            extra={"project_id": project.id, "organization_id": project.organization_id},
        )

    try:
        detector = _ensure_metric_detector(
            project, owner_team_id=owner_team.id if owner_team else None, enabled=True
        )
        logger.info(
            "create_metric_detector_with_owner.created",
            extra={"project_id": project.id, "detector_id": detector.id},
        )
    except UnableToAcquireLockApiError as e:
        sentry_sdk.capture_exception(e)


post_save.connect(
    create_project_detectors, sender=Project, dispatch_uid="create_project_detectors", weak=False
)
project_created.connect(
    create_metric_detector_with_owner,
    dispatch_uid="create_metric_detector_with_owner",
    weak=False,
)
