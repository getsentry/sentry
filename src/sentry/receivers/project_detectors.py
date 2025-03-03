import logging

import sentry_sdk
from django.db import IntegrityError
from django.db.models.signals import post_save

from sentry import features
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.project import Project
from sentry.workflow_engine.models import Detector

logger = logging.getLogger(__name__)


def create_project_detectors(instance, created, **kwargs):
    if created:
        try:
            if features.has(
                "organizations:workflow-engine-issue-alert-dual-write", instance.organization
            ):
                Detector.objects.create(
                    name="Error Detector", type=ErrorGroupType.slug, project=instance, config={}
                )
                logger.info("project.detector-created", extra={"project_id": instance.id})
        except IntegrityError as e:
            sentry_sdk.capture_exception(e)


post_save.connect(
    create_project_detectors, sender=Project, dispatch_uid="create_project_detectors", weak=False
)
