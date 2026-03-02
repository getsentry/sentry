from __future__ import annotations

import logging

from django.db import router, transaction

from sentry.locks import locks
from sentry.models.project import Project
from sentry.processing_errors.grouptype import SourcemapCheckStatus, SourcemapConfigurationType
from sentry.workflow_engine.models import DataConditionGroup, Detector, DetectorState
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.types import DetectorPriorityLevel

logger = logging.getLogger(__name__)


def ensure_sourcemap_detector(project: Project) -> Detector:
    """
    Ensure that a sourcemap configuration detector exists for this project.
    Returns the existing detector or creates one with its associated
    DataConditionGroup, DataConditions, and DetectorState.
    """
    slug = SourcemapConfigurationType.slug

    try:
        return Detector.get_default_detector_for_project(project.id, slug)
    except Detector.DoesNotExist:
        pass

    lock = locks.get(
        f"sourcemap-detector:{project.id}",
        duration=2,
        name="sourcemap_detector_provision",
    )

    with (
        lock.blocking_acquire(initial_delay=0.1, timeout=3),
        transaction.atomic(router.db_for_write(Detector)),
    ):
        existing = Detector.objects.filter(type=slug, project=project).first()
        if existing:
            return existing

        condition_group = DataConditionGroup.objects.create(
            logic_type=DataConditionGroup.Type.ANY,
            organization_id=project.organization_id,
        )

        DataCondition.objects.create(
            comparison=SourcemapCheckStatus.FAILURE,
            type=Condition.EQUAL,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=condition_group,
        )

        DataCondition.objects.create(
            comparison=SourcemapCheckStatus.SUCCESS,
            type=Condition.EQUAL,
            condition_result=DetectorPriorityLevel.OK,
            condition_group=condition_group,
        )

        detector = Detector.objects.create(
            type=slug,
            project=project,
            name="Sourcemap Configuration",
            config={},
            workflow_condition_group=condition_group,
        )

        DetectorState.objects.create(
            detector=detector,
            detector_group_key=None,
            is_triggered=False,
            state=DetectorPriorityLevel.OK,
        )

        return detector
