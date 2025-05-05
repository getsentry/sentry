import logging

import sentry_sdk
from django.db import IntegrityError

from sentry import features
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.project import Project
from sentry.signals import project_created
from sentry.utils.rollback_metrics import incr_rollback_metrics
from sentry.workflow_engine.models import Detector

logger = logging.getLogger(__name__)


def create_project_detectors(project: Project, **kwargs):
    try:
        if features.has(
            "organizations:workflow-engine-issue-alert-dual-write", project.organization
        ):
            Detector.objects.create(
                name="Error Detector", type=ErrorGroupType.slug, project=project, config={}
            )
            logger.info("project.detector-created", extra={"project_id": project.id})
    except IntegrityError as e:
        incr_rollback_metrics(Detector)
        sentry_sdk.capture_exception(e)


project_created.connect(
    create_project_detectors, dispatch_uid="create_project_detectors", weak=False
)
