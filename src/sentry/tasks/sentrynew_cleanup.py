"""
SentryNew cleanup task - placed in sentry codebase for proper integration.
This is a working version that can be called by Celery.
"""

import logging

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import selfhosted_tasks

logger = logging.getLogger("sentry.tasks.sentrynew_cleanup")


@instrumented_task(
    name="sentry.tasks.sentrynew_cleanup.cleanup_expired_sentrynew_organizations",
    queue="update",
    time_limit=300,
    soft_time_limit=240,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=selfhosted_tasks,
        processing_deadline_duration=300,
    ),
)
def cleanup_expired_sentrynew_organizations():
    """
    Cleanup expired SentryNew organizations.
    This task connects directly to the getsentry database to find expired orgs.
    """
    # Import inside function to avoid circular imports
    import json
    from datetime import datetime

    from django.conf import settings
    from django.db import connection
    from django.utils import timezone

    logger.info("=== SENTRYNEW CLEANUP TASK CALLED ===")
    logger.info(f"Task called at: {datetime.now()}")

    # Log the configuration
    cleanup_enabled = getattr(settings, "SENTRYNEW_CLEANUP_ENABLED", False)
    logger.info(f"SENTRYNEW_CLEANUP_ENABLED = {cleanup_enabled}")

    if not cleanup_enabled:
        logger.info("SentryNew cleanup is disabled")
        return {"status": "disabled", "reason": "SENTRYNEW_CLEANUP_ENABLED is False"}

    logger.info("Starting SentryNew organization cleanup")

    stats = {"checked": 0, "deleted": 0, "failed": 0, "errors": []}

    try:
        # Use raw SQL to find expired orgs in the getsentry database
        # This avoids import issues with getsentry models
        with connection.cursor() as cursor:
            # Check if the table exists first
            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'accounts_thirdpartyaccount'
                )
            """
            )

            if not cursor.fetchone()[0]:
                logger.warning("accounts_thirdpartyaccount table not found - may be wrong database")
                # Try connecting to getsentry database specifically
                from django.db import connections

                if "getsentry" in connections:
                    cursor = connections["getsentry"].cursor()
                else:
                    return {"status": "error", "message": "Cannot access getsentry database"}

            # Find expired, unclaimed sentrynew orgs
            # Note: We check metadata->>'claimed', not partnership_agreement_restricted
            # partnership_agreement_restricted only indicates if the modal was dismissed
            cursor.execute(
                """
                SELECT
                    pa.organization_id,
                    pa.external_id,
                    o.slug,
                    o.status,
                    pa.metadata
                FROM accounts_thirdpartyaccount pa
                JOIN sentry_organization o ON o.id = pa.organization_id
                WHERE pa.type = 'SN'
                  AND pa.is_active = true
                  AND (pa.metadata->>'claimed' IS NULL OR pa.metadata->>'claimed' = 'false')
                  AND pa.metadata->>'expires_at' < %s
                  AND o.status = 0
                LIMIT 20
            """,
                [timezone.now().isoformat()],
            )

            expired_orgs = cursor.fetchall()
            stats["checked"] = len(expired_orgs)

            logger.info(f"Found {len(expired_orgs)} expired SentryNew organizations to check")

            # Also log how many total SN orgs exist for debugging
            cursor.execute("SELECT COUNT(*) FROM accounts_thirdpartyaccount WHERE type = 'SN'")
            total_sn = cursor.fetchone()[0]
            logger.info(f"Total SentryNew orgs in database: {total_sn}")

            for org_id, external_id, slug, status, metadata in expired_orgs:
                try:
                    logger.info(f"Processing org {slug} (ID: {org_id})")

                    # Import here to avoid circular dependency
                    from sentry.models.organization import Organization, OrganizationStatus

                    # Get the Organization object
                    org = Organization.objects.get(id=org_id)

                    # Use soft delete
                    if getattr(settings, "SENTRYNEW_SOFT_DELETE", True):
                        org.status = OrganizationStatus.PENDING_DELETION
                        org.save(update_fields=["status"])
                        logger.info(f"Soft deleted org {slug}")
                        stats["deleted"] += 1

                        # Update metadata to track deletion
                        cursor.execute(
                            """
                            UPDATE accounts_thirdpartyaccount
                            SET metadata = jsonb_set(
                                COALESCE(metadata, '{}'::jsonb),
                                '{deleted_at}',
                                to_jsonb(%s::text)
                            )
                            WHERE organization_id = %s
                        """,
                            [timezone.now().isoformat(), org_id],
                        )

                    else:
                        # Hard delete via organization service
                        from sentry.services.organization import organization_service
                        from sentry.services.organization.serial import serialize_generic_user

                        system_user = type(
                            "User",
                            (),
                            {
                                "id": 0,
                                "email": "system@sentrynew.cleanup",
                                "username": "sentrynew_cleanup",
                            },
                        )()

                        response = organization_service.delete_organization(
                            organization_id=org_id, user=serialize_generic_user(system_user)
                        )

                        if hasattr(response, "success") and response.success:
                            logger.info(f"Hard deleted org {slug}")
                            stats["deleted"] += 1
                        else:
                            logger.error(f"Failed to delete org {slug}")
                            stats["failed"] += 1

                except Organization.DoesNotExist:
                    logger.warning(f"Organization {org_id} not found")
                    stats["failed"] += 1

                except Exception as e:
                    logger.error(f"Error deleting org {org_id}: {e}")
                    stats["failed"] += 1
                    stats["errors"].append(str(e))

        logger.info(f"Cleanup complete. Deleted: {stats['deleted']}, Failed: {stats['failed']}")

    except Exception as e:
        logger.error(f"Cleanup task failed: {e}")
        stats["errors"].append(str(e))

    return stats


# For manual testing
if __name__ == "__main__":
    result = cleanup_expired_sentrynew_organizations()
    print(f"Result: {result}")
