import logging

from django.db.models import Exists, Func, JSONField, OuterRef

from sentry import options
from sentry.models.organization import Organization, OrganizationStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import workflow_engine_tasks

logger = logging.getLogger(__name__)

HEALTH_CHECK_BUFFER_SIZE = 1000


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
        Organization.objects.filter(status=OrganizationStatus.ACTIVE)
        .annotate(has_all_projects_detector=Exists(all_projects_detector))
        .filter(has_all_projects_detector=False)
        .values_list("id", flat=True)[:HEALTH_CHECK_BUFFER_SIZE]
    )

    org_count = 0
    for organization_id in organization_ids:
        ensure_default_detectors_for_organization.delay(organization_id=organization_id)
        org_count += 1

    logger.info(
        "workflow_engine.tasks.health_check_organization_detectors.dispatched",
        extra={"org_count": org_count},
    )


@instrumented_task(
    name="sentry.workflow_engine.tasks.health_check.ensure_default_detectors_for_organization",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
)
def ensure_default_detectors_for_organization(organization_id: int) -> None:
    from sentry.workflow_engine.defaults.detectors import ensure_default_organization_detectors

    organization = Organization.objects.get_or_none(
        id=organization_id, status=OrganizationStatus.ACTIVE
    )
    if organization:
        ensure_default_organization_detectors(organization)
