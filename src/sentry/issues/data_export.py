import gzip
import logging
import threading
from collections.abc import Iterator
from queue import Queue

from google.cloud.storage.bucket import Bucket
from google.cloud.storage.client import Client

from sentry.models.organization import Organization
from sentry.services import eventstore
from sentry.services.eventstore.models import Event
from sentry.snuba.dataset import Dataset
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import json

logger = logging.getLogger(__name__)

# TODO: need to benchmark performance (time / memory) & cost (Bigtable reads + GCS writes)
# TODO: add error handling / retries / logging


BATCH_SIZE = 10000  # Events per batch
UPLOAD_QUEUE_SIZE = 50  # Buffer uploads to prevent blocking
REFERRER = "sentry.internal.eu-compliance-data-export.errors"


def upload_to_gcs(compressed_data: bytes, file_counter: int, bucket: Bucket, gcs_prefix: str):
    # TODO: we might want the blob name to be something else
    blob_name = f"{gcs_prefix}/events_{file_counter:06d}.jsonl.gz"
    blob = bucket.blob(blob_name)
    blob.upload_from_string(
        compressed_data,
        content_type="application/gzip",
        timeout=300,  # 5 minute timeout
    )


# TODO: uploader will probably change
def background_uploader(
    upload_queue: Queue[bytes | None], destination_bucket: str, gcs_prefix: str
):
    file_counter = 0
    storage_client = Client()
    bucket = storage_client.bucket(destination_bucket)

    while True:
        # Get data from queue (blocks until available)
        data = upload_queue.get()

        if data is None:  # Stop signal
            break

        file_counter += 1
        upload_to_gcs(data, file_counter, bucket, gcs_prefix)


def add_events_to_upload_queue(events_data: list[dict], upload_queue: Queue[bytes | None]):
    jsonl_data = []
    for event_data in events_data:
        if event_data:
            jsonl_data.append(json.dumps(event_data))

    if not jsonl_data:
        return

    jsonl_content = "\n".join(jsonl_data) + "\n"
    compressed_data = gzip.compress(jsonl_content.encode("utf-8"))

    upload_queue.put(compressed_data)


def process_event_batch(events: list[Event]) -> list[dict]:
    results = []

    for event in events:
        if event.data:
            event_data = dict(event.data)
            results.append(event_data)
        else:
            logger.warning("No data for event", extra={"event_id": event.event_id})

    return results


def process_event_batches(
    event_batches: Iterator[list[Event]],
    destination_bucket: str,
    gcs_prefix: str,
):
    # Create upload queue and background uploader
    upload_queue: Queue[bytes | None] = Queue(maxsize=UPLOAD_QUEUE_SIZE)
    upload_thread = threading.Thread(
        target=background_uploader,
        args=(upload_queue, destination_bucket, gcs_prefix),
    )
    upload_thread.start()

    for batch in event_batches:
        events_data = process_event_batch(batch)
        add_events_to_upload_queue(events_data, upload_queue)

    upload_queue.put(None)  # Signal upload thread to finish
    upload_thread.join(timeout=300)  # Wait for upload thread to complete - 5 minute timeout


def get_event_batches(
    organization_id: int, event_filter: eventstore.Filter
) -> Iterator[list[Event]]:
    offset = 0
    while True:
        event_batch = eventstore.backend.get_events(
            filter=event_filter,
            limit=BATCH_SIZE,
            offset=offset,
            referrer=REFERRER,
            dataset=Dataset.Events,
            tenant_ids={"organization_id": organization_id},
        )

        if not event_batch:
            break

        yield event_batch
        offset += BATCH_SIZE


# TODO: run as task?
@instrumented_task(
    name="sentry.issues.tasks.export_project_errors_async",
    taskworker_config=TaskworkerConfig(namespace=issues_tasks),
)
def export_project_errors_async(
    project_id: int, organization_id: int, destination_bucket: str, gcs_prefix: str
):
    # Export all events within retention for this project
    event_filter = eventstore.Filter(
        project_ids=[project_id],
        start=None,
        end=None,
    )
    event_batches = get_event_batches(organization_id, event_filter)

    process_event_batches(event_batches, destination_bucket, gcs_prefix)

    logger.info("Errors data export completed for project", extra={"project_id": project_id})


# TODO: add tests
def export_errors_data(
    organization_id: int,
    destination_bucket: str,
    gcs_prefix: str,
):
    """
    Export all error events within retention for an organization (across all projects) to GCS.

    Args:
        organization_id: The ID of the organization to export data for.
        destination_bucket: The GCS bucket to export data to.
        gcs_prefix: The GCS prefix path within the bucket to export data to.
    """

    try:
        organization = Organization.objects.get(id=organization_id)
        logger.info(
            "Exporting error events for organization",
            extra={"organization_id": organization.id, "organization_name": organization.name},
        )
    except Organization.DoesNotExist:
        logger.exception("Could not find organization", extra={"organization_id": organization_id})
        return None

    projects = list(organization.project_set.all())
    if not projects:
        logger.warning(
            "No projects found for organization", extra={"organization_id": organization_id}
        )
        return None
    logger.info(
        "Found projects to export errors data for",
        extra={"project_count": len(projects)},
    )

    for project in projects:
        export_project_errors_async.delay(
            project_id=project.id,
            organization_id=organization_id,
            destination_bucket=destination_bucket,
            gcs_prefix=gcs_prefix,
        )
        logger.info("Scheduled task to export errors for project", extra={"project_id": project.id})

    logger.info("Completed scheduling tasks for exporting error events for all projects")
