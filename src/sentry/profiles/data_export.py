import logging
from datetime import timedelta

from google.cloud.storage_transfer_v1 import TransferJob

from sentry.models.organization import Organization
from sentry.replays.data_export import create_transfer_job, request_create_transfer_job

logger = logging.getLogger(__name__)

EXPORT_JOB_DURATION_DEFAULT = timedelta(days=5)
EXPORT_JOB_SOURCE_BUCKET = "sentryio-profiles"


def export_profiles_data(
    organization_id: int,
    gcp_project_id: str,
    destination_bucket: str,
    destination_prefix: str,
    blob_export_job_duration: timedelta = EXPORT_JOB_DURATION_DEFAULT,
    source_bucket: str = EXPORT_JOB_SOURCE_BUCKET,
    pubsub_topic_name: str | None = None,
) -> TransferJob:
    logger.info(
        "Starting profiles export...",
        extra={
            "organization_id": organization_id,
            "gcp_project_id": gcp_project_id,
            "destination_bucket": destination_bucket,
            "blob_export_job_duration": str(blob_export_job_duration),
            "source_bucket": source_bucket,
            "pubsub_topic_name": pubsub_topic_name,
        },
    )

    try:
        organization = Organization.objects.filter(id=organization_id).get()
        logger.info("Found organization", extra={"organization.slug": organization.slug})
    except Organization.DoesNotExist:
        logger.exception("Could not find organization", extra={"organization.id": organization_id})
        raise

    job = create_transfer_job(
        gcp_project_id=gcp_project_id,
        transfer_job_name=None,
        source_bucket=source_bucket,
        source_prefix=f"{organization_id}/",
        destination_bucket=destination_bucket,
        destination_prefix=destination_prefix,
        notification_topic=pubsub_topic_name,
        job_description="Profiles EU Compliance Export",
        job_duration=blob_export_job_duration,
        do_create_transfer_job=request_create_transfer_job,
    )
    logger.info("Successfully scheduled recording export job.")
    return job
