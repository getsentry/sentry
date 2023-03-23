import logging

from sentry import audit_log, features
from sentry.integrations.utils.codecov import has_codecov_integration
from sentry.models.organization import Organization, OrganizationStatus
from sentry.tasks.base import instrumented_task
from sentry.utils.audit import create_system_audit_entry
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.auto_enable_codecov")


@instrumented_task(
    name="sentry.tasks.auto_enable_codecov.schedule_organizations",
    queue="auto_enable_codecov",
    max_retries=0,
)  # type: ignore
def schedule_organizations(dry_run=False) -> None:
    """
    Queue tasks to enable codecov for each organization.

    Note that this is not gated by the V2 flag so we can enable the V2
    features independently of the auto-enablement.
    """
    logger.info("Starting task for sentry.tasks.auto_enable_codecov.schedule_organizations")

    organizations = Organization.objects.filter(status=OrganizationStatus.ACTIVE)
    logger.info(f"Processing {len(organizations)} organizations for codecov auto-enable")
    for _, organization in enumerate(
        RangeQuerySetWrapper(organizations, step=1000, result_value_getter=lambda item: item.id)
    ):
        if not features.has("organizations:codecov-stacktrace-integration", organization):
            logger.warning(
                f"Skipping {organizations.id}: organizations:codecov-stacktrace-integration is False"
            )
            continue

        if not features.has("organizations:auto-enable-codecov", organization):
            logger.warning(
                f"Processing {len(organizations)}: organizations:auto-enable-codecov is False"
            )
            continue

        # Create a celery task per organization
        logger.info(f"Queuing organization for codecov access {organization.id}")
        enable_for_organization.delay(organization.id)


@instrumented_task(  # type: ignore
    name="sentry.tasks.auto_enable_codecov.enable_for_organization",
    queue="auto_enable_codecov",
    max_retries=5,
)
def enable_for_organization(organization_id: int, dry_run=False) -> None:
    """
    Set the codecov_access flag to True for organizations with a valid Codecov integration.
    """
    try:
        logger.info(f"Attempting to enable codecov for organization {organization_id}")
        organization = Organization.objects.get(id=organization_id)
        has_integration, _ = has_codecov_integration(organization)
        if not has_integration:
            logger.warning(f"No codecov integration exists for organization {organization_id}")
            return

        if organization.flags.codecov_access.is_set:
            logger.warning(
                f"Codecov Access flag already set to {organization.flags.codecov_access}"
            )
            return

        organization.flags.codecov_access = True
        logger.info(f"Setting Codecov Access flag for organization {organization_id}")
        organization.save()

        create_system_audit_entry(
            organization=organization,
            target_object=organization.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            data={"codecov_access": "to True"},
        )

    except Organization.DoesNotExist:
        logger.exception(
            "Organization does not exist.",
            extra={"organization_id": organization_id},
        )
    except Exception:
        logger.exception(
            "Error checking for Codecov integration",
            extra={"organization_id": organization_id},
        )
