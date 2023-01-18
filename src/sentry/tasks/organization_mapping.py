import logging
from datetime import datetime, timedelta

from django.contrib.postgres.aggregates import ArrayAgg
from django.db.models import Count
from django.utils import timezone

from sentry.models.organizationmapping import OrganizationMapping
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper

ORGANIZATION_MAPPING_EXPIRY = timedelta(hours=2)

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.organization_mapping.repair_mappings",
    queue="hybrid_cloud.control_repair",
    default_retry_delay=5,
    max_retries=5,
)  # type: ignore
def repair_mappings() -> None:
    metrics.incr("sentry.hybrid_cloud.tasks.organizationmapping.start", sample_rate=1.0)
    with metrics.timer("sentry.hybrid_cloud.tasks.organizationmapping.repair", sample_rate=1.0):
        expiration_threshold_time = timezone.now() - ORGANIZATION_MAPPING_EXPIRY
        _verify_mappings(expiration_threshold_time)
        _remove_duplicate_mappings(expiration_threshold_time)


def _verify_mappings(expiration_threshold_time: datetime) -> None:
    # For each unverified mapping in the control silo
    for mapping in RangeQuerySetWrapper(OrganizationMapping.objects.filter(verified=False)):
        # Lookup organization record in the region silo
        org = organization_service.get_organization_by_id(
            id=mapping.organization_id, slug=mapping.slug
        )
        if org is None and mapping.date_created <= expiration_threshold_time:
            mapping.delete()
        elif org is not None:
            mapping.verified = True
            mapping.idempotency_key = ""
            mapping.save()


def _remove_duplicate_mappings(expiration_threshold_time: datetime) -> None:
    duplicates_query = (
        OrganizationMapping.objects.values("organization_id")
        .annotate(total=Count("*"), slugs=ArrayAgg("slug"))
        .filter(total__gt=1)
    )

    # Enumerate orgs with multiple mappings, remove ones that don't exist in region silo
    for dupe in duplicates_query:
        metrics.incr(
            "sentry.hybrid_cloud.tasks.organizationmapping.remove_duplicate", sample_rate=1.0
        )
        organization_id = dupe["organization_id"]

        # Organization exists in the region silo
        found_org = organization_service.get_organization_by_id(id=organization_id)
        if found_org is None:
            # Delete all mappings.
            OrganizationMapping.objects.filter(organization_id=organization_id).delete()
            return

        # Delete all expired mappings that don't match this org slug
        OrganizationMapping.objects.filter(
            organization_id=organization_id, date_created__lte=expiration_threshold_time
        ).exclude(slug=found_org.organization.slug).delete()
