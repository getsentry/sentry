import logging
from collections.abc import Mapping
from datetime import timedelta
from functools import cache

from django.db import router, transaction
from rest_framework import status

from sentry import features, options
from sentry.api.exceptions import SentryAPIException
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.issue_detection.performance_detection import PERFORMANCE_DETECTOR_CONFIG_MAPPINGS
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.projectoptions.defaults import DEFAULT_PROJECT_PERFORMANCE_DETECTION_SETTINGS
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
    ALL_PROJECTS_DETECTOR_NAME,
    ERROR_DETECTOR_NAME,
    ISSUE_STREAM_DETECTOR_NAME,
    DetectorPriorityLevel,
    DetectorType,
)

# Preserve existing provisioning labels independently of output issue descriptions.
DEFAULT_DETECTOR_NAMES = {
    DetectorType.ERROR: ERROR_DETECTOR_NAME,
    DetectorType.ISSUE_STREAM: ISSUE_STREAM_DETECTOR_NAME,
    DetectorType.PERFORMANCE_SLOW_DB_QUERY: "Slow DB Query",
    DetectorType.PERFORMANCE_LARGE_HTTP_PAYLOAD: "Large HTTP payload",
    DetectorType.QUERY_INJECTION_VULNERABILITY: "Potential Query Injection Vulnerability",
}

logger = logging.getLogger(__name__)


@cache
def get_disabled_platforms_by_detector_type() -> Mapping[str, frozenset[str]]:
    """
    Map WFE detector types to platforms where they should be disabled by default.
    Derives from DEFAULT_DETECTOR_DISABLING_CONFIGS using the detection_enabled_key.
    """
    from sentry.issue_detection.detectors.disable_detectors import (
        DEFAULT_DETECTOR_DISABLING_CONFIGS,
    )

    disabled_by_detector_type: dict[str, frozenset[str]] = {}

    for disable_config in DEFAULT_DETECTOR_DISABLING_CONFIGS:
        detector_option_key = disable_config["detector_project_option"]
        languages_to_disable = disable_config["languages_to_disable"]

        # Find matching WFE detector via detection_enabled_key
        for mapping in PERFORMANCE_DETECTOR_CONFIG_MAPPINGS.values():
            if mapping.detection_enabled_key == detector_option_key:
                disabled_by_detector_type[mapping.wfe_detector_type] = frozenset(
                    languages_to_disable
                )
                break

    return disabled_by_detector_type


class UnableToAcquireLockApiError(SentryAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "unable_to_acquire_lock"
    message = "Unable to acquire lock for issue alert migration."


def _ensure_detector(project: Project, type: str, default_enabled: bool = True) -> Detector:
    """
    Ensure that a detector of a given type exists for a project.
    If the Detector doesn't already exist, we lock the project row to avoid double-creating.
    """
    detector_type = DetectorType(type)
    if detector_type not in DEFAULT_DETECTOR_NAMES:
        raise ValueError(f"Invalid default detector type: {detector_type}")

    # If it already exists, life is simple and we can return immediately.
    # If there happen to be duplicates, we prefer the oldest.
    existing = Detector.objects.filter(type=detector_type, project=project).order_by("id").first()
    if existing:
        return existing

    # If we may need to create it, we lock the project row to avoid double-creating.
    # There isn't a unique constraint on the detector, so we can't rely on get_or_create
    # to avoid duplicates.
    #
    # The row lock is held until the outermost transaction ends, so a concurrent caller
    # waits until our detector is committed, then finds it in get_or_create.
    with transaction.atomic(router.db_for_write(Detector)):
        Project.objects.select_for_update(no_key=True).get(id=project.id)
        detector, _ = Detector.objects.get_or_create(
            type=detector_type,
            project=project,
            defaults={
                "config": {},
                "name": DEFAULT_DETECTOR_NAMES[detector_type],
                "enabled": default_enabled,
            },
        )
        return detector


def ensure_default_anomaly_detector(
    project: Project, owner_team_id: int | None = None, enabled: bool = True
) -> Detector | None:
    """
    Ensure that a default anomaly detection metric monitor exists for a project.
    If the Detector doesn't already exist, we try to acquire a lock to avoid double-creating.
    """
    # If it already exists, return immediately. Prefer the oldest if duplicates exist.
    existing = (
        Detector.objects.filter(type=DetectorType.METRIC_ISSUE, project=project)
        .order_by("id")
        .first()
    )
    if existing:
        logger.info(
            "create_default_anomaly_detector.already_exists",
            extra={"project_id": project.id, "detector_id": existing.id},
        )
        return existing

    lock = locks.get(
        f"workflow-engine-project-{DetectorType.METRIC_ISSUE}-detector:{project.id}",
        duration=2,
        name=f"workflow_engine_default_{DetectorType.METRIC_ISSUE}_detector",
    )
    try:
        with (
            lock.blocking_acquire(initial_delay=0.1, timeout=3),
            transaction.atomic(router.db_for_write(Detector)),
        ):
            # Double-check after acquiring lock in case another process created it
            existing = (
                Detector.objects.filter(type=DetectorType.METRIC_ISSUE, project=project)
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
                    type=DetectorType.METRIC_ISSUE,
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


def ensure_performance_detectors(project: Project) -> dict[str, Detector]:
    if not features.has("projects:workflow-engine-performance-detectors", project):
        return {}

    disabled_platforms_map = get_disabled_platforms_by_detector_type()

    detectors = {}
    for mapping in PERFORMANCE_DETECTOR_CONFIG_MAPPINGS.values():
        detector_type = mapping.wfe_detector_type

        # Determine initial enabled state based on platform and default settings
        disabled_platforms = disabled_platforms_map.get(detector_type, frozenset())
        default_enabled = DEFAULT_PROJECT_PERFORMANCE_DETECTION_SETTINGS[
            mapping.detection_enabled_key
        ]
        enabled = (project.platform not in disabled_platforms) and default_enabled

        detectors[detector_type] = _ensure_detector(project, detector_type, default_enabled=enabled)

    return detectors


def ensure_default_all_projects_detector(organization_id: int) -> Detector:
    """
    Ensure that an org-scoped all-project detector exists for the organization.
    This detector has project=NULL and config={"organization_id": org_id}.

    Raises on UnableToAcquireLockApiError
    """
    from sentry.workflow_engine.processors.detector import query_all_projects_detector

    existing = query_all_projects_detector(organization_id=organization_id)
    if existing:
        return existing

    lock = locks.get(
        f"workflow-engine-org-{DetectorType.ISSUE_STREAM}-detector:{organization_id}",
        duration=2,
        name=f"workflow_engine_all_project_{DetectorType.ISSUE_STREAM}_detector",
    )
    try:
        with (
            lock.blocking_acquire(initial_delay=0.1, timeout=3),
            transaction.atomic(router.db_for_write(Detector)),
        ):
            existing = query_all_projects_detector(organization_id=organization_id)
            if existing:
                return existing

            return Detector.objects.create(
                type=DetectorType.ISSUE_STREAM,
                project=None,
                config={"organization_id": organization_id},
                name=ALL_PROJECTS_DETECTOR_NAME,
                enabled=True,
            )
    except UnableToAcquireLock:
        raise UnableToAcquireLockApiError


def ensure_default_organization_detectors(organization: Organization) -> dict[str, Detector]:
    """
    Raises on UnableToAcquireLockApiError
    """
    detectors: dict[str, Detector] = {}
    if options.get("workflow_engine.auto_creation.all_projects_detector"):
        detectors[DetectorType.ISSUE_STREAM] = ensure_default_all_projects_detector(
            organization_id=organization.id
        )
    return detectors


def ensure_default_detectors(project: Project) -> dict[str, Detector]:
    detectors: dict[str, Detector] = {}
    detectors[DetectorType.ERROR] = _ensure_detector(project, DetectorType.ERROR)
    detectors[DetectorType.ISSUE_STREAM] = _ensure_detector(project, DetectorType.ISSUE_STREAM)
    detectors.update(ensure_performance_detectors(project))
    return detectors
