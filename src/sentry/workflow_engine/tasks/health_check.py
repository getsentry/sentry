import logging

from django.db.models import Count, Exists, Func, JSONField, OuterRef, Q, QuerySet

from sentry import options
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import workflow_engine_tasks

logger = logging.getLogger(__name__)

HEALTH_CHECK_BUFFER_SIZE = 1000
# Performance detectors are intentionally excluded because their expected presence depends on a
# project-scoped feature flag. These are the only detector types expected for every active project.
SYSTEM_DETECTOR_TYPES = ("error", "issue_stream")
NUM_EXPECTED_CORE_DETECTORS = len(SYSTEM_DETECTOR_TYPES)


def _organizations_missing_all_projects_detector() -> QuerySet[Organization]:
    from sentry.workflow_engine.models import Detector

    all_projects_detector = Detector.objects.filter(
        type="issue_stream",
        project__isnull=True,
        config__organization_id=Func(OuterRef("id"), function="to_jsonb", output_field=JSONField()),
    )
    return Organization.objects.annotate(
        has_all_projects_detector=Exists(all_projects_detector)
    ).filter(has_all_projects_detector=False)


@instrumented_task(
    name="sentry.workflow_engine.tasks.health_check.health_check_organization_detectors",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=60 * 5,
    silo_mode=SiloMode.CELL,
)
def health_check_organization_detectors() -> None:
    from sentry.workflow_engine.models import Detector

    if not options.get("workflow_engine.tasks.health_check_organization.enabled"):
        return

    if not options.get("workflow_engine.auto_creation.all_projects_detector"):
        return

    all_projects_detector = Detector.objects.filter(
        type="issue_stream",
        project__isnull=True,
        config__organization_id=Func(OuterRef("id"), function="to_jsonb", output_field=JSONField()),
    )
    organization_ids = (
        Organization.objects.annotate(has_all_projects_detector=Exists(all_projects_detector))
        .filter(has_all_projects_detector=False)
        .values_list("id", flat=True)[:HEALTH_CHECK_BUFFER_SIZE]
    )

    org_count = 0
    for organization_id in organization_ids:
        ensure_default_detectors_for_org.delay(organization_id=organization_id)
        org_count += 1

    logger.info(
        "workflow_engine.tasks.health_check_organization_detectors.dispatched",
        extra={"org_count": org_count},
    )


@instrumented_task(
    name="sentry.workflow_engine.tasks.health_check.health_check_project_detectors",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=60 * 5,
    silo_mode=SiloMode.CELL,
)
def health_check_project_detectors() -> None:
    if not options.get("workflow_engine.tasks.health_check_project.enabled"):
        return

    project_ids = (
        Project.objects.filter(status=ObjectStatus.ACTIVE)
        .annotate(
            num_system_detectors=Count(
                "detector__type",
                distinct=True,
                filter=Q(detector__type__in=SYSTEM_DETECTOR_TYPES),
            )
        )
        .filter(num_system_detectors__lt=NUM_EXPECTED_CORE_DETECTORS)
        .values_list("id", flat=True)[:HEALTH_CHECK_BUFFER_SIZE]
    )

    project_count = 0
    for project_id in project_ids:
        ensure_default_detectors_for_project.delay(project_id=project_id)
        project_count += 1

    logger.info(
        "workflow_engine.tasks.health_check_project_detectors.dispatched",
        extra={"project_count": project_count},
    )


@instrumented_task(
    name="sentry.workflow_engine.tasks.health_check.ensure_default_detectors_for_org",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
)
def ensure_default_detectors_for_org(organization_id: int) -> None:
    from sentry.workflow_engine.defaults.detectors import ensure_default_organization_detectors

    organization = Organization.objects.get_or_none(id=organization_id, status=ObjectStatus.ACTIVE)
    if organization:
        ensure_default_organization_detectors(organization)


@instrumented_task(
    name="sentry.workflow_engine.tasks.health_check.ensure_default_detectors_for_project",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
)
def ensure_default_detectors_for_project(project_id: int) -> None:
    from sentry.workflow_engine.defaults.detectors import ensure_default_detectors

    project = Project.objects.get_or_none(id=project_id, status=ObjectStatus.ACTIVE)
    if project:
        ensure_default_detectors(project)
