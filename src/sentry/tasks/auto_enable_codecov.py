import logging

from sentry import audit_log, features
from sentry.integrations.utils.codecov import has_codecov_integration
from sentry.models.organization import Organization, OrganizationStatus
from sentry.tasks.base import instrumented_task
from sentry.utils.audit import create_system_audit_entry
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)


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
    for organization in RangeQuerySetWrapper(
        Organization.objects.filter(status=OrganizationStatus.ACTIVE)
    ):
        should_auto_enable = features.has("organizations:auto-enable-codecov", organization)
        if should_auto_enable:
            logger.info(
                "Processing organization",
                extra={"organization_id": organization.id},
            )
            enable_for_organization(organization.id)


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
        logger.info(
            "Attempting to enable codecov for organization",
            extra={"organization_id": organization_id},
        )
        organization = Organization.objects.get(id=organization_id)
        has_integration, error = has_codecov_integration(organization)
        if not has_integration:
            logger.warning(
                "No codecov integration exists for organization",
                extra={"organization_id": organization.id, "error": error},
            )
            return

        if organization.flags.codecov_access.is_set:
            logger.warning(
                "Codecov Access flag already set.",
                extra={
                    "organization_id": organization.id,
                    "codecov_access": organization.flags.codecov_access,
                },
            )
            return

        organization.flags.codecov_access = True
        organization.save()
        logger.info(
            "Enabled Codecov Access flag for organization",
            extra={
                "organization_id": organization.id,
                "codecov_access": organization.flags.codecov_access,
            },
        )

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
