import base64
import csv
import io
import logging
import uuid
from collections.abc import Callable, Generator
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

from django.db.models import F
from google.cloud import storage_transfer_v1
from google.cloud.storage_transfer_v1 import (
    CreateTransferJobRequest,
    GcsData,
    NotificationConfig,
    RunTransferJobRequest,
    Schedule,
    TransferJob,
    TransferSpec,
)
from google.type import date_pb2
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Limit,
    Offset,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry.models.files.utils import get_storage
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import replays_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import json
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

EXPORT_JOB_DURATION_DEFAULT = timedelta(days=5)

# $$  __$$\ $$ |      \_$$  _|$$  __$$\ $$ | $$  |$$ |  $$ |$$  __$$\ $$ |  $$ |$$  __$$\ $$  _____|
#  $$$$$$\  $$\       $$$$$$\  $$$$$$\  $$\   $$\ $$\   $$\  $$$$$$\  $$\   $$\  $$$$$$\  $$$$$$$$\
# $$ /  \__|$$ |        $$ |  $$ /  \__|$$ |$$  / $$ |  $$ |$$ /  $$ |$$ |  $$ |$$ /  \__|$$ |
# $$ |      $$ |        $$ |  $$ |      $$$$$  /  $$$$$$$$ |$$ |  $$ |$$ |  $$ |\$$$$$$\  $$$$$\
# $$ |      $$ |        $$ |  $$ |      $$  $$<   $$  __$$ |$$ |  $$ |$$ |  $$ | \____$$\ $$  __|
# $$ |  $$\ $$ |        $$ |  $$ |  $$\ $$ |\$$\  $$ |  $$ |$$ |  $$ |$$ |  $$ |$$\   $$ |$$ |
# \$$$$$$  |$$$$$$$$\ $$$$$$\ \$$$$$$  |$$ | \$$\ $$ |  $$ | $$$$$$  |\$$$$$$  |\$$$$$$  |$$$$$$$$\
#  \______/ \________|\______| \______/ \__|  \__|\__|  \__| \______/  \______/  \______/ \________|


class QueryFnProtocol(Protocol):
    def __call__(self, limit: int, offset: int) -> Request: ...


def row_iterator_to_csv(rows: list[dict[str, Any]]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)

    for i, row in enumerate(rows):
        if i == 0:
            writer.writerow(row.keys())

        writer.writerow(row.values())

    return buf.getvalue()


def export_clickhouse_rows(
    query_fn: QueryFnProtocol,
    referrer: str = "sentry.internal.eu-compliance-data-export",
    num_pages: int = 1,
    limit: int = 1000,
    offset: int = 0,
) -> Generator[dict[str, Any]]:
    """
    ClickHouse row export.

    :param query_fn: Any function which returns a request which is paginatable by limit and offset.
    :param referrer: A unique identifier for a given data-export query.
    :param limit: The number of rows to limit the query by.
    :param offset: The initial offset value to offset the query by.
    :param num_pages: The maximum number of pages we'll query before exiting. The number of pages
        we query is intentionally capped. This ensures termination and encourages appropriate
        bounding by the calling function.
    :param max_retries: The maximum number of queries we'll make to the database before quitting.
    :param retry_after_seconds: The number of seconds to wait after each query failure.
    """
    assert limit > 0, "limit mus`t be a positive integer greater than zero."
    assert num_pages > 0, "num_pages must be a positive integer greater than zero."
    assert offset >= 0, "offset must be a positive integer greater than or equal to zero."

    # Iteration is capped to a maximum number of pages. This ensures termination and encourages
    # appropriate bounding by the calling function. Ideally this export is ran in an asynchonrous
    # task. Tasks typically have a deadline so iterating forever is undesireable. Each task should
    # process a chunk of data commit it (and perhaps its progress) and then schedule another task
    # to complete the remainder of the job which itself is bounded.
    for _ in range(num_pages):
        results = raw_snql_query(query_fn(limit=limit, offset=offset), referrer)["data"]
        if results:
            yield from results

        offset += len(results)

        if len(results) != limit:
            break


#  $$$$$$\   $$$$$$\   $$$$$$\
# $$  __$$\ $$  __$$\ $$  __$$\
# $$ /  \__|$$ /  \__|$$ /  \__|
# $$ |$$$$\ $$ |      \$$$$$$\
# $$ |\_$$ |$$ |       \____$$\
# $$ |  $$ |$$ |  $$\ $$\   $$ |
# \$$$$$$  |\$$$$$$  |\$$$$$$  |
#  \______/  \______/  \______/


def request_create_transfer_job(request: CreateTransferJobRequest) -> None:
    client = storage_transfer_v1.StorageTransferServiceClient()
    client.create_transfer_job(request)
    return None


def create_transfer_job[T](
    gcs_project_id: str,
    transfer_job_name: str | None,
    source_bucket: str,
    source_prefix: str,
    destination_bucket: str,
    job_duration: timedelta,
    do_create_transfer_job: Callable[[CreateTransferJobRequest], T],
    notification_topic: str | None = None,
    get_current_datetime: Callable[[], datetime] = lambda: datetime.now(tz=timezone.utc),
) -> T:
    """
    Create a transfer-job which copies a bucket by prefix to another bucket.

    Transfer jobs are templates for transfer-job-runs. Transfer jobs do not automatically create
    transfer-job-runs. You can run a transfer-job manually but this function will define a
    schedule for automatic transfer-job-run creation. Once the schedules constraints are met GCS
    will create a transfer-job-run automatically. Automatic run creation is one-time only (for the
    schedule adopted by this function). If it fails or you want to run the transfer-job twice you
    will need to manually create a transfer-job-run on the second attempt.

    Failure notifications are handled by pubsub. When the transfer service fails it will send a
    notification to the specified topic. That topic should be configured to propagate the failure
    notice to our HTTP endpoint which will then call the appropriate retry function.

    :param gcs_project_id:
    :param source_bucket:
    :param source_prefix:
    :param destination_bucket:
    :param job_duration: The amount of time the job should take to complete. Longer runs put less
        pressure on our buckets.
    :param notification_topic: Specifying a topic will enable automatic run retries on failure.
    :param do_create_transfer_job: Injected function which creates the transfer-job.
    :param get_current_datetime: Injected function which computes the current datetime.
    """
    date_job_starts = get_current_datetime()
    date_job_ends = date_job_starts + job_duration

    transfer_job = TransferJob(
        description="Session Replay EU Compliance Export",
        project_id=gcs_project_id,
        status=storage_transfer_v1.TransferJob.Status.ENABLED,
        transfer_spec=TransferSpec(
            gcs_data_source=GcsData(bucket_name=source_bucket, path=source_prefix),
            gcs_data_sink=GcsData(bucket_name=destination_bucket),
        ),
        schedule=Schedule(
            schedule_start_date=date_pb2.Date(
                year=date_job_starts.year,
                month=date_job_starts.month,
                day=date_job_starts.day,
            ),
            schedule_end_date=date_pb2.Date(
                year=date_job_ends.year,
                month=date_job_ends.month,
                day=date_job_ends.day,
            ),
        ),
    )

    if notification_topic:
        transfer_job.notification_config = NotificationConfig(
            pubsub_topic=notification_topic,
            event_types=[NotificationConfig.EventType.TRANSFER_OPERATION_FAILED],
            payload_format=NotificationConfig.PayloadFormat.JSON,
        )

    if transfer_job_name:
        transfer_job.name = transfer_job_name

    request = CreateTransferJobRequest(transfer_job=transfer_job)
    return do_create_transfer_job(request)


def request_run_transfer_job(request: RunTransferJobRequest) -> None:
    client = storage_transfer_v1.StorageTransferServiceClient()
    client.run_transfer_job(request)
    return None


def retry_transfer_job_run[T](
    event: dict[str, Any],
    do_run_transfer_job: Callable[[RunTransferJobRequest], T],
) -> T | None:
    """
    Retry failed transfer job run.

    :param event:
    :param do_run_transfer_job:
    """
    if "data" not in event:
        return None

    # Decode the Pub/Sub message payload
    message = base64.b64decode(event["data"]).decode("utf-8")
    payload = json.loads(message)

    # Check for a failed transfer operation
    if "transferOperation" in payload and payload["transferOperation"]["status"] == "FAILED":
        job_name = payload["transferOperation"]["transferJobName"]
        gcs_project_id = payload["transferOperation"]["projectId"]

        request = RunTransferJobRequest(job_name=job_name, project_id=gcs_project_id)
        return do_run_transfer_job(request)

    return None


# $$$$$$$\  $$$$$$$$\ $$$$$$$\  $$\        $$$$$$\ $$\     $$\
# $$  __$$\ $$  _____|$$  __$$\ $$ |      $$  __$$\\$$\   $$  |
# $$ |  $$ |$$ |      $$ |  $$ |$$ |      $$ /  $$ |\$$\ $$  /
# $$$$$$$  |$$$$$\    $$$$$$$  |$$ |      $$$$$$$$ | \$$$$  /
# $$  __$$< $$  __|   $$  ____/ $$ |      $$  __$$ |  \$$  /
# $$ |  $$ |$$ |      $$ |      $$ |      $$ |  $$ |   $$ |
# $$ |  $$ |$$$$$$$$\ $$ |      $$$$$$$$\ $$ |  $$ |   $$ |
# \__|  \__|\________|\__|      \________|\__|  \__|   \__|


def query_replays_dataset(
    project_id: int,
    start: datetime,
    end: datetime,
    limit: int,
    offset: int,
) -> Request:
    assert start < end, "Start date must be less than the ending date."
    assert project_id > 0, "Project ID must be greater than zero."
    assert limit > 0, "limit must be a positive integer greater than zero."
    assert offset >= 0, "offset must be a positive integer greater than or equal to zero."

    def hash_(value: Column | str) -> Function:
        return Function("cityHash64", parameters=[value])

    query = Query(
        match=Entity("replays"),
        select=[
            Column("replay_id"),
            Column("debug_id"),
            Column("count_info_events"),
            Column("count_warning_events"),
            Column("count_error_events"),
            Column("info_id"),
            Column("warning_id"),
            Column("error_id"),
            Column("fatal_id"),
            Column("replay_type"),
            Column("error_sample_rate"),
            Column("session_sample_rate"),
            Column("event_hash"),
            Column("segment_id"),
            Column("trace_ids"),
            Column("title"),
            Column("url"),
            Column("urls"),
            Column("is_archived"),
            Column("error_ids"),
            Column("project_id"),
            Column("timestamp"),
            Column("replay_start_timestamp"),
            Column("platform"),
            Column("environment"),
            Column("release"),
            Column("dist"),
            Column("ip_address_v4"),
            Column("ip_address_v6"),
            Column("user"),
            Column("user_id"),
            Column("user_name"),
            Column("user_email"),
            Column("user_geo_city"),
            Column("user_geo_country_code"),
            Column("user_geo_region"),
            Column("user_geo_subdivision"),
            Column("viewed_by_id"),
            Column("os_name"),
            Column("os_version"),
            Column("browser_name"),
            Column("browser_version"),
            Column("device_name"),
            Column("device_brand"),
            Column("device_family"),
            Column("device_model"),
            Column("ota_updates_channel"),
            Column("ota_updates_runtime_version"),
            Column("ota_updates_update_id"),
            Column("sdk_name"),
            Column("sdk_version"),
            Column("tags.key"),
            Column("tags.value"),
            Column("click_node_id"),
            Column("click_tag"),
            Column("click_id"),
            Column("click_class"),
            Column("click_text"),
            Column("click_role"),
            Column("click_alt"),
            Column("click_testid"),
            Column("click_aria_label"),
            Column("click_title"),
            Column("click_component_name"),
            Column("click_is_dead"),
            Column("click_is_rage"),
            Column("count_errors"),
            Column("count_urls"),
            Column("retention_days"),
            Column("partition"),
            Column("offset"),
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
        ],
        orderby=[
            OrderBy(Column("project_id"), Direction.ASC),
            OrderBy(Function("toStartOfDay", parameters=[Column("timestamp")]), Direction.ASC),
            OrderBy(hash_(Column("replay_id")), Direction.ASC),
            OrderBy(Column("event_hash"), Direction.ASC),
        ],
        limit=Limit(limit),
        offset=Offset(offset),
    )

    return Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=query,
        tenant_ids={},
    )


def get_replay_date_query_ranges(project_id: int) -> Generator[tuple[datetime, datetime]]:
    """
    SQL:
        SELECT formatDateTime(toStartOfDay(timestamp), '%F')
        FROM replays_dist
        WHERE project_id = 11276
        GROUP BY toStartOfDay(timestamp)
        ORDER BY toStartOfDay(timestamp)
    """
    to_start_of_day_timestamp = Function("toStartOfDay", parameters=[Column("timestamp")])

    # Snuba requires a start and end range but we don't know the start and end yet! We specify an
    # arbitrarily large range to accommodate. If you're debugging a failed export in the year 3000
    # I am very sorry for the inconvenience this has caused you.
    min_date = datetime(year=1970, month=1, day=1)
    max_date = datetime(year=3000, month=1, day=1)

    query = Query(
        match=Entity("replays"),
        select=[
            Function("formatDateTime", parameters=[to_start_of_day_timestamp, "%F"], alias="day")
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("timestamp"), Op.GTE, min_date),
            Condition(Column("timestamp"), Op.LT, max_date),
        ],
        orderby=[OrderBy(to_start_of_day_timestamp, Direction.ASC)],
        groupby=[to_start_of_day_timestamp],
    )

    request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=query,
        tenant_ids={},
    )

    results = raw_snql_query(request, "sentry.internal.eu-compliance-data-export.dates")["data"]
    for result in results:
        start = datetime.fromisoformat(result["day"])
        end = start + timedelta(days=1)
        yield start, end


def export_replay_row_set(
    project_id: int,
    start: datetime,
    end: datetime,
    limit: int,
    initial_offset: int,
    write_to_sink: Callable[[str, str], None],
    num_pages: int = 10,
) -> int | None:
    rows = list(
        export_clickhouse_rows(
            lambda limit, offset: query_replays_dataset(project_id, start, end, limit, offset),
            limit=limit,
            offset=initial_offset,
            num_pages=num_pages,
        )
    )

    if len(rows) > 0:
        filename = f"replay-row-data/{uuid.uuid4().hex}"
        csv_data = row_iterator_to_csv(rows)
        write_to_sink(filename, csv_data)

    if len(rows) == (limit * num_pages):
        return initial_offset + len(rows)
    else:
        return None


def save_to_storage(destination_bucket: str, filename: str, contents: str) -> None:
    storage = get_storage(None)
    storage.bucket_name = destination_bucket
    storage.save(filename, io.BytesIO(contents.encode()))


@instrumented_task(
    name="sentry.replays.tasks.export_replay_row_set_async",
    default_retry_delay=5,
    max_retries=120,
    taskworker_config=TaskworkerConfig(
        namespace=replays_tasks,
        processing_deadline_duration=15 * 60 + 5,
        retry=Retry(
            times=120,
            delay=5,
        ),
    ),
)
def export_replay_row_set_async(
    project_id: int,
    start: datetime,
    end: datetime,
    destination_bucket: str,
    limit: int = 1000,
    offset: int = 0,
    num_pages: int = 10,
):
    assert limit > 0, "Limit must be greater than 0."
    assert offset >= 0, "Offset must be greater than or equal to 0."
    assert start < end, "Start must be before end date."
    assert num_pages > 0, "num_pages must be greater than 0."

    next_offset = export_replay_row_set(
        project_id,
        start,
        end,
        limit,
        offset,
        lambda filename, contents: save_to_storage(destination_bucket, filename, contents),
        num_pages,
    )

    # Tasks can run for a defined length of time. The export can take an unbounded length of time
    # to complete. For this reason we cap the amount of work we'll perform within a single task's
    # lifetime and schedule the remainder of the work to take place on another task.
    if next_offset:
        assert next_offset > offset, "Next offset was not greater than previous offset."
        export_replay_row_set_async.delay(
            project_id=project_id,
            start=start,
            end=end,
            limit=limit,
            offset=next_offset,
            destination_bucket=destination_bucket,
            num_pages=num_pages,
        )


@instrumented_task(
    name="sentry.replays.tasks.export_replay_project_async",
    taskworker_config=TaskworkerConfig(namespace=replays_tasks),
)
def export_replay_project_async(
    project_id: int,
    limit: int,
    destination_bucket: str,
    num_pages: int = 10,
):
    # Each populated day bucket is scheduled for export.
    for start, end in get_replay_date_query_ranges(project_id):
        export_replay_row_set_async.delay(
            project_id=project_id,
            start=start,
            end=end,
            destination_bucket=destination_bucket,
            limit=limit,
            offset=0,
            num_pages=num_pages,
        )


def export_replay_blob_data[T](
    project_id: int,
    gcs_project_id: str,
    destination_bucket: str,
    job_duration: timedelta,
    do_create_transfer_job: Callable[[CreateTransferJobRequest], T],
    pubsub_topic_name: str | None = None,
    source_bucket: str = "sentry-replays",
):
    # In the future we could set a non-unique transfer-job name. This would prevent duplicate runs
    # from doing the same work over and over again. However, we'd need to catch the exception,
    # look-up any active runs, and, if no active runs, schedule a new run. This is a bit much for
    # now.
    #
    # transfer_job_name = f"{source_bucket}/{project_id}/{start_date_rounded_to_day}"

    for retention_days in (30, 60, 90):
        create_transfer_job(
            gcs_project_id=gcs_project_id,
            transfer_job_name=None,
            source_bucket=source_bucket,
            source_prefix=f"{retention_days}/{project_id}",
            destination_bucket=destination_bucket,
            notification_topic=pubsub_topic_name,
            job_duration=job_duration,
            do_create_transfer_job=do_create_transfer_job,
        )


def export_replay_data(
    organization_id: int,
    gcs_project_id: str,
    destination_bucket: str,
    blob_export_job_duration: timedelta = EXPORT_JOB_DURATION_DEFAULT,
    database_rows_per_page: int = 1000,
    database_pages_per_task: int = 10,
    source_bucket: str = "sentry-replays",
    pubsub_topic_name: str | None = None,
):
    logger.info("Starting replay export...")

    try:
        organization = Organization.objects.filter(id=organization_id).get()
        logger.info("Found organization", extra={"organization.slug": organization.slug})
    except Organization.DoesNotExist:
        logger.exception("Could not find organization", extra={"organization.id": organization_id})
        return None

    projects = list(
        Project.objects.filter(
            organization_id=organization_id, flags=F("flags").bitor(Project.flags.has_replays)
        )
    )

    if not projects:
        logger.info("No projects with replays found.")
        return None

    logger.info("Found projects with replays.", extra={"number_of_projects": len(projects)})

    for project in projects:
        logger.info(
            "Starting recording export job for project", extra={"project_slug": project.slug}
        )
        export_replay_blob_data(
            project_id=project.id,
            gcs_project_id=gcs_project_id,
            destination_bucket=destination_bucket,
            pubsub_topic_name=pubsub_topic_name,
            source_bucket=source_bucket,
            job_duration=blob_export_job_duration,
            do_create_transfer_job=request_create_transfer_job,
        )
        logger.info("Successfully scheduled recording export job.")

    for project in projects:
        logger.info(
            "Starting database export job for project", extra={"project_slug": project.slug}
        )
        export_replay_project_async.delay(
            project_id=project.id,
            limit=database_rows_per_page,
            destination_bucket=destination_bucket,
            num_pages=database_pages_per_task,
        )
        logger.info("Successfully scheduled database export job.")

    # Really need a way to signal an export has finished or failed. Probably a screen in the
    # application exposed to the customer or admins. This will require database models, front-end
    # engineers, API blueprints, a concept of a work group...
    logger.info("Export finished! It will run in the background. No further action is required.")
