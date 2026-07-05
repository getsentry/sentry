import logging
from datetime import timedelta

from django.db import router, transaction
from rest_framework import status

from sentry.api.exceptions import SentryAPIException
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.issue_detection.performance_detection import PERFORMANCE_DETECTOR_CONFIG_MAPPINGS
from sentry.issues import grouptype
from sentry.locks import locks
from sentry.models.project import Project
from sentry.seer.anomaly_detection.store_data_workflow_engine import send_new_detector_data
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.utils.locking import UnableToAcquireLock
from sentry.workflow_engine.models import (
    DataCondition,
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import (
    ERROR_DETECTOR_NAME,
    ISSUE_STREAM_DETECTOR_NAME,
    DetectorPriorityLevel,
)
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

VALID_DEFAULT_DETECTOR_TYPES = [
    ErrorGroupType.slug,
    IssueStreamGroupType.slug,
    *[m.wfe_detector_type for m in PERFORMANCE_DETECTOR_CONFIG_MAPPINGS.values()],
]

logger = logging.getLogger(__name__)


class UnableToAcquireLockApiError(SentryAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "unable_to_acquire_lock"
    message = "Unable to acquire lock for issue alert migration."


def _ensure_detector(project: Project, type: str, default_enabled: bool = True) -> Detector:
    """
    Ensure that a detector of a given type exists for a project.
    If the Detector doesn't already exist, we try to acquire a lock to avoid double-creating,
    and UnableToAcquireLockApiError if that fails.
    """
    group_type = grouptype.registry.get_by_slug(type)
    if not group_type:
        raise ValueError(f"Group type {type} not registered")
    slug = group_type.slug
    if slug not in VALID_DEFAULT_DETECTOR_TYPES:
        raise ValueError(f"Invalid default detector type: {slug}")

    # If it already exists, life is simple and we can return immediately.
    # If there happen to be duplicates, we prefer the oldest.
    existing = Detector.objects.filter(type=slug, project=project).order_by("id").first()
    if existing:
        return existing

    # If we may need to create it, we acquire a lock to avoid double-creating.
    # There isn't a unique constraint on the detector, so we can't rely on get_or_create
    # to avoid duplicates.
    # However, by only locking during the one-time creation, the window for a race condition is small.
    lock = locks.get(
        f"workflow-engine-project-{slug}-detector:{project.id}",
        duration=2,
        name=f"workflow_engine_default_{slug}_detector",
    )
    try:
        with (
            # Creation should be fast, so it's worth blocking a little rather
            # than failing a request.
            lock.blocking_acquire(initial_delay=0.1, timeout=3),
            transaction.atomic(router.db_for_write(Detector)),
        ):
            detector, _ = Detector.objects.get_or_create(
                type=slug,
                project=project,
                defaults={
                    "config": {},
                    "name": (
                        ERROR_DETECTOR_NAME
                        if slug == ErrorGroupType.slug
                        else ISSUE_STREAM_DETECTOR_NAME
                        if slug == IssueStreamGroupType.slug
                        else group_type.description
                    ),
                    "enabled": default_enabled,
                },
            )
            return detector
    except UnableToAcquireLock:
        raise UnableToAcquireLockApiError


def ensure_default_anomaly_detector(
    project: Project, owner_team_id: int | None = None, enabled: bool = True
) -> Detector | None:
    """
    Ensure that a default anomaly detection metric monitor exists for a project.
    If the Detector doesn't already exist, we try to acquire a lock to avoid double-creating.
    """
    # If it already exists, return immediately. Prefer the oldest if duplicates exist.
    existing = (
        Detector.objects.filter(type=MetricIssue.slug, project=project).order_by("id").first()
    )
    if existing:
        logger.info(
            "create_default_anomaly_detector.already_exists",
            extra={"project_id": project.id, "detector_id": existing.id},
        )
        return existing

    lock = locks.get(
        f"workflow-engine-project-{MetricIssue.slug}-detector:{project.id}",
        duration=2,
        name=f"workflow_engine_default_{MetricIssue.slug}_detector",
    )
    try:
        with (
            lock.blocking_acquire(initial_delay=0.1, timeout=3),
            transaction.atomic(router.db_for_write(Detector)),
        ):
            # Double-check after acquiring lock in case another process created it
            existing = (
                Detector.objects.filter(type=MetricIssue.slug, project=project)
                .order_by("id")
                .first()
            )
            if existing:
                return existing

            try:
                condition_group = DataConditionGroup.objects.create(
                    logic_type=DataConditionGroup.Type.ANY,
                    organization_id=project.organization_id,
                )

                DataCondition.objects.create(
                    comparison={
                        "sensitivity": AnomalyDetectionSensitivity.LOW,
                        "seasonality": AnomalyDetectionSeasonality.AUTO,
                        "threshold_type": AnomalyDetectionThresholdType.ABOVE,
                    },
                    condition_result=DetectorPriorityLevel.HIGH,
                    type=Condition.ANOMALY_DETECTION,
                    condition_group=condition_group,
                )

                detector = Detector.objects.create(
                    project=project,
                    name="High Error Count (Default)",
                    description="Automatically monitors for anomalous spikes in error count",
                    workflow_condition_group=condition_group,
                    type=MetricIssue.slug,
                    config={
                        "detection_type": AlertRuleDetectionType.DYNAMIC.value,
                        "comparison_delta": None,
                    },
                    owner_team_id=owner_team_id,
                    enabled=enabled,
                )

                snuba_query = create_snuba_query(
                    query_type=SnubaQuery.Type.ERROR,
                    dataset=Dataset.Events,
                    query="",
                    aggregate="count()",
                    time_window=timedelta(minutes=15),
                    resolution=timedelta(minutes=15),
                    environment=None,
                    event_types=[SnubaQueryEventType.EventType.ERROR],
                )

                query_subscription = create_snuba_subscription(
                    project=project,
                    subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                    snuba_query=snuba_query,
                )

                data_source = DataSource.objects.create(
                    organization_id=project.organization_id,
                    source_id=str(query_subscription.id),
                    type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
                )

                DataSourceDetector.objects.create(
                    data_source=data_source,
                    detector=detector,
                )
            except Exception:
                logger.exception(
                    "create_default_anomaly_detector.create_models_failed",
                    extra={"project_id": project.id, "organization_id": project.organization_id},
                )
                raise

            try:
                send_new_detector_data(detector)
            except Exception:
                logger.exception(
                    "create_default_anomaly_detector.send_to_seer_failed",
                    extra={"project_id": project.id, "organization_id": project.organization_id},
                )
                raise

            return detector
    except UnableToAcquireLock:
        raise UnableToAcquireLockApiError


def ensure_default_detectors(project: Project) -> dict[str, Detector]:
    detectors: dict[str, Detector] = {}
    detectors[ErrorGroupType.slug] = _ensure_detector(project, ErrorGroupType.slug)
    detectors[IssueStreamGroupType.slug] = _ensure_detector(project, IssueStreamGroupType.slug)
    return detectors
