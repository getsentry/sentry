import logging
from contextlib import contextmanager

import sentry_sdk
from django.db.models.signals import post_save

from sentry import features
from sentry.models.project import Project
from sentry.signals import project_created
from sentry.workflow_engine.processors.detector import (
    UnableToAcquireLockApiError,
    ensure_default_anomaly_detector,
    ensure_default_detectors,
)

logger = logging.getLogger(__name__)


@contextmanager
def disable_default_detector_creation():
    """
    Context manager that temporarily disconnects the signal handlers that create
    default detectors, preventing them from being created when a project is saved.
    """
    # Disconnect both signals
    post_save.disconnect(
        create_project_detectors, sender=Project, dispatch_uid="create_project_detectors"
    )
    project_created.disconnect(
        create_default_anomaly_detector, dispatch_uid="create_default_anomaly_detector"
    )
    try:
        yield
    finally:
        # Always reconnect the signals, even if an exception occurred
        post_save.connect(
            create_project_detectors,
            sender=Project,
            dispatch_uid="create_project_detectors",
            weak=False,
        )
        project_created.connect(
            create_default_anomaly_detector,
            dispatch_uid="create_default_anomaly_detector",
            weak=False,
        )


def create_project_detectors(instance, created, **kwargs):
    if created:
        try:
            ensure_default_detectors(instance)
        except UnableToAcquireLockApiError as e:
            sentry_sdk.capture_exception(e)


def create_default_anomaly_detector(project: Project, user=None, user_id=None, **kwargs):
    """
    Creates default anomaly detector when project is created, with the team as owner.
    This listens to project_created signal which provides user information.
    """

    if not features.has("organizations:default-anomaly-detector", project.organization, actor=user):
        return

    owner_team = project.teams.first()

    if owner_team is None:
        logger.info(
            "create_default_anomaly_detector.no_team",
            extra={"project_id": project.id, "organization_id": project.organization_id},
        )

    try:
        enabled = features.has(
            "organizations:anomaly-detection-alerts", project.organization, actor=user
        )
        detector = ensure_default_anomaly_detector(
            project, owner_team_id=owner_team.id if owner_team else None, enabled=enabled
        )
        if detector:
            logger.info(
                "create_default_anomaly_detector.created",
                extra={"project_id": project.id, "detector_id": detector.id, "enabled": enabled},
            )
    except UnableToAcquireLockApiError as e:
        logger.warning(
            "create_default_anomaly_detector.lock_failed",
            extra={"project_id": project.id, "organization_id": project.organization_id},
        )
        sentry_sdk.capture_exception(e)
    except Exception:
        logger.exception(
            "create_default_anomaly_detector.failed",
            extra={"project_id": project.id, "organization_id": project.organization_id},
        )


post_save.connect(
    create_project_detectors, sender=Project, dispatch_uid="create_project_detectors", weak=False
)
project_created.connect(
    create_default_anomaly_detector,
    dispatch_uid="create_default_anomaly_detector",
    weak=False,
)
