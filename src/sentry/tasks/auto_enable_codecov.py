import logging

from sentry import audit_log, features
from sentry.integrations.utils.codecov import has_codecov_integration
from sentry.models.organization import Organization, OrganizationStatus
from sentry.tasks.base import instrumented_task
from sentry.utils.audit import create_system_audit_entry
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.auto_enable_codecov.enable_for_org",
    queue="auto_enable_codecov",
    max_retries=0,
)  # type: ignore
def enable_for_org(dry_run: bool = False) -> None:
    """
    Set the codecov_access flag to True for organizations with a valid Codecov integration.
    """
    logger.info("Starting task for sentry.tasks.auto_enable_codecov.enable_for_org")
    for organization in RangeQuerySetWrapper(
        Organization.objects.filter(status=OrganizationStatus.ACTIVE)
    ):
        integration_enabled = features.has("organizations:codecov-integration", organization)
        task_enabled = features.has("organizations:auto-enable-codecov", organization)
        if not integration_enabled or not task_enabled:
            if organization.flags.codecov_access.is_set:
                disable_codecov_access(organization, integration_enabled, task_enabled)
            continue

        logger.info(
            "Processing organization",
            extra={
                "organization_id": organization.id,
                "integration_enabled": integration_enabled,
                "task_enabled": task_enabled,
            },
        )
        try:
            if organization.flags.codecov_access.is_set:
                logger.info(
                    "Codecov Access flag already set",
                    extra={
                        "organization_id": organization.id,
                        "codecov_access": organization.flags.codecov_access,
                    },
                )
                continue

            has_integration, error = has_codecov_integration(organization)
            if not has_integration:
                logger.info(
                    "No codecov integration exists for organization",
                    extra={"organization_id": organization.id, "error": error},
                )
                continue

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
        except Exception:
            logger.exception(
                "Error checking for Codecov integration",
                extra={"organization_id": organization.id},
            )


def disable_codecov_access(
    organization: Organization, integration_enabled: bool, task_enabled: bool
) -> None:
    organization.flags.codecov_access = False
    organization.save()
    logger.info(
        "Disabled Codecov Access flag for dev organization",
        extra={
            "organization_id": organization.id,
            "codecov_access": organization.flags.codecov_access,
            "integration_enabled": integration_enabled,
            "task_enabled": task_enabled,
        },
    )
    create_system_audit_entry(
        organization=organization,
        target_object=organization.id,
        event=audit_log.get_event_id("ORG_EDIT"),
        data={"codecov_access": "to False"},
    )
