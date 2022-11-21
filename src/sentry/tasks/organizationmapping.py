import logging
from datetime import timedelta

from django.db import connection
from django.utils import timezone

from sentry.models.organizationmapping import OrganizationMapping
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

ORGANIZATION_MAPPING_EXPIRY = timedelta(hours=4)

logger = logging.getLogger("tasks.releasemonitor")


@instrumented_task(
    name="sentry.hybrid_cloud.tasks.organizationmapping",
    queue="#####TODO",
    default_retry_delay=5,
    max_retries=5,
)  # type: ignore
def organizationmapping_repair(**kwargs) -> None:
    metrics.incr("sentry.hybrid_cloud.tasks.organizationmapping.start", sample_rate=1.0)
    with metrics.timer("sentry.hybrid_cloud.tasks.organizationmapping.repair", sample_rate=1.0):
        expiration_threshold_time = timezone.now() - ORGANIZATION_MAPPING_EXPIRY
        # Enumerate unverified mappings, mark verified if they exist in the region silo, delete them if they're > 4 hours old
        for mapping in OrganizationMapping.objects.filter(verified=False).iterator():
            org = organization_service.get_organization_by_id(
                id=mapping.organization_id, user_id=None
            )
            if org is None and mapping.created <= expiration_threshold_time:
                mapping.delete()
            elif org is not None:
                mapping.verified = True
                mapping.save()

        # Enumerate orgs with multiple mappings, remove ones that don't exist in region silo
        with connection.cursor() as cursor:
            cursor.execute(
                """
                    SELECT organization_id, array_agg(slug) as slugs, count(*)
                    FROM sentry_organizationmapping
                    GROUP BY organization_id
                    HAVING count(*) > 1
                """,
            )
            columns = [col[0] for col in cursor.description]
            duplicate_mappings = [dict(zip(columns, row)) for row in cursor.fetchall()]
            for dupe in duplicate_mappings:
                found_org = organization_service.get_organization_by_id(
                    id=dupe["organization_id"], user_id=None
                )
                if found_org is None:
                    # Delete all mappings. Orgs stick around for awhile after being deleted, so this is safe
                    OrganizationMapping.objects.filter(
                        organization_id=dupe["organization_id"]
                    ).delete()
                else:
                    # Delete all expired mappings that don't match this org slug
                    for mapping in OrganizationMapping.objects.filter(
                        organization_id=dupe["organization_id"]
                    ):
                        if (
                            mapping.slug != found_org.organization.slug
                            and mapping.created <= expiration_threshold_time
                        ):
                            mapping.delete()
