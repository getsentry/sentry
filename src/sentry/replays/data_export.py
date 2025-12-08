import base64
import csv
import io
import logging
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
from sentry.services.filestore.gcs import GoogleCloudStorage
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import replays_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import json
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

EXPORT_JOB_SOURCE_BUCKET = "sentry-replays"
EXPORT_QUERY_ROWS_PER_PAGE = 1000
EXPORT_QUERY_PAGES_PER_TASK = 10

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


def rows_to_csv(rows: list[dict[str, Any]]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)

    for i, row in enumerate(rows):
        if i == 0:
            writer.writerow(row.keys())

        writer.writerow(row.values())

    return buf.getvalue()


def export_clickhouse_rows(
    query_fn: QueryFnProtocol,
    referrer: str = Referrer.EU_DATA_EXPORT.value,
    num_pages: int = EXPORT_QUERY_PAGES_PER_TASK,
    limit: int = EXPORT_QUERY_ROWS_PER_PAGE,
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
    assert limit > 0, "limit must be a positive integer greater than zero."
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


def request_create_transfer_job(request: CreateTransferJobRequest) -> TransferJob:
    client = storage_transfer_v1.StorageTransferServiceClient()
    return client.create_transfer_job(request)


def create_transfer_job[T](
    gcp_project_id: str,
    transfer_job_name: str | None,
    source_bucket: str,
    source_prefix: str,
    destination_bucket: str,
    destination_prefix: str,
    job_description: str,
    do_create_transfer_job: Callable[[CreateTransferJobRequest], T],
    notification_topic: str | None = None,
    get_current_datetime: Callable[[], datetime] = lambda: datetime.now(tz=timezone.utc),
) -> T:
    """
    Create a transfer-job which copies a bucket by prefix to another bucket.

    Transfer jobs are templates for transfer-job-runs. Transfer jobs are run based on a schedule.
    To run a job once, the schedule start and end dates are set to the same day.
    Automatic run creation based on the schedule is one-time only. If it fails or you want to run
    the transfer-job twice you will need to manually create a transfer-job-run on the second attempt.

    Failure notifications are handled by pubsub. When the transfer service fails it will send a
    notification to the specified topic. That topic should be configured to propagate the failure
    notice to our HTTP endpoint which will then call the appropriate retry function.

    :param gcp_project_id: The GCP project_id. This can be extracted from the storage class
        returned by `get_storage` function.
    :param source_bucket:
    :param source_prefix:
    :param destination_bucket:
    :param destination_prefix:
    :param notification_topic: topic to which we'll notify the success or failure of the transfer.
    :param do_create_transfer_job: Injected function which creates the transfer-job.
    :param get_current_datetime: Injected function which computes the current datetime.
    """
    date_job_starts = get_current_datetime()
    # To make this a one-shot job, the start and end dates must be the same.
    date_job_ends = date_job_starts

    transfer_job = TransferJob(
        description=job_description,
        project_id=gcp_project_id,
        status=storage_transfer_v1.TransferJob.Status.ENABLED,
        transfer_spec=TransferSpec(
            gcs_data_source=GcsData(bucket_name=source_bucket, path=source_prefix),
            gcs_data_sink=GcsData(bucket_name=destination_bucket, path=destination_prefix),
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
            pubsub_topic=f"projects/{gcp_project_id}/topics/{notification_topic}",
            event_types=[
                NotificationConfig.EventType.TRANSFER_OPERATION_FAILED,
                NotificationConfig.EventType.TRANSFER_OPERATION_SUCCESS,
                NotificationConfig.EventType.TRANSFER_OPERATION_ABORTED,
            ],
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
    Retry a failed transfer job run.

    This function expects an event structured in the Google Cloud pubsub notification format.

    :param event:
    :param do_run_transfer_job: Any callback function which triggers a `run_transfer_job` action
        on GCP. You should use `request_run_transfer_job` by default unless you need to manually
        specify credentials or have some other divergent behavior.
    """
    if "data" not in event:
        return None

    # Decode the Pub/Sub message payload
    message = base64.b64decode(event["data"]).decode("utf-8")
    payload = json.loads(message)

    # Check for a failed transfer operation
    if "transferOperation" in payload and payload["transferOperation"]["status"] == "FAILED":
        job_name = payload["transferOperation"]["transferJobName"]
        gcp_project_id = payload["transferOperation"]["projectId"]

        request = RunTransferJobRequest(job_name=job_name, project_id=gcp_project_id)
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


def get_replay_date_query_ranges(
    project_id: int,
    referrer: str = Referrer.EU_DATA_EXPORT.value,
) -> Generator[tuple[datetime, datetime, int]]:
    """
    SQL:
        SELECT formatDateTime(toStartOfDay(timestamp), '%F'), count()
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
            Function("formatDateTime", parameters=[to_start_of_day_timestamp, "%F"], alias="day"),
            Function("count", parameters=[], alias="max_rows_to_export"),
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

    results = raw_snql_query(request, referrer)["data"]
    for result in results:
        start = datetime.fromisoformat(result["day"])
        end = start + timedelta(days=1)
        yield start, end, result["max_rows_to_export"]


def export_replay_row_set(
    project_id: int,
    start: datetime,
    end: datetime,
    limit: int,
    initial_offset: int,
    write_to_storage: Callable[[str, str], None],
    num_pages: int = EXPORT_QUERY_PAGES_PER_TASK,
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
        filename = f"clickhouse/session-replay/{project_id}/{start.isoformat()}/{end.isoformat()}/{initial_offset}"
        csv_data = rows_to_csv(rows)
        write_to_storage(filename, csv_data)

    if len(rows) == (limit * num_pages):
        return initial_offset + len(rows)
    else:
        return None


def save_to_storage(destination_bucket: str, filename: str, contents: str) -> None:
    storage = get_storage(None)
    assert isinstance(storage, GoogleCloudStorage)
    storage.bucket_name = destination_bucket
    storage.save(filename, io.BytesIO(contents.encode()))


@instrumented_task(
    name="sentry.replays.tasks.export_replay_row_set_async",
    namespace=replays_tasks,
    processing_deadline_duration=15 * 60,
    retry=Retry(times=120, delay=5),
)
def export_replay_row_set_async(
    project_id: int,
    start: datetime,
    end: datetime,
    destination_bucket: str,
    max_rows_to_export: int,
    limit: int = EXPORT_QUERY_ROWS_PER_PAGE,
    offset: int = 0,
    num_pages: int = EXPORT_QUERY_PAGES_PER_TASK,
):
    """
    Export all replay rows which belong to the project and exist within the range.

    :param project_id: Sentry Project ID.
    :param start: Inclusive, minimum date in the queried range.
    :param end: Exclusive, maximum date in the queried range.
    :param destination_bucket: Which bucket the resulting CSV will be uploaded for.
    :param max_rows_to_export: The maximum number of rows which may be executed by this task
        chain. The max_rows_to_export value should match the number of rows present in your range.
        This value is specified to protect against malformed behavior in the code which might
        produce infinite (or at least very long) task recursion.
    :param file_number: The file's position in the export sequence. Incremented by one each time
        the task is chained. This keeps filenames predictable and ordered.
    :param limit: The maximum number of rows to query by for a given page.
    :param offset: The offset within the query range to query for. Must constantly increment and
        never overlap with previous runs.
    :param num_pages: The maximum number of pages to query per task.
    """
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
    #
    # The call chain is explicitly terminated by a pre-computed max_rows_to_export value. If this
    # value is exceeded the chain exits immediately even if more rows could have been found. Its
    # unlikely there will be more rows because in order to export your data you need to terminate
    # your Sentry account. Under those conditions you're no longer a Sentry customer and should
    # not be ingesting any data into Sentry.
    if next_offset and next_offset < max_rows_to_export:
        # We assert the call chain is making forward progress.
        assert next_offset > offset, "next_offset was not greater than previous offset."
        # We assert the call chain is making meaningful progress. We should not overlap.
        assert next_offset == (offset + (limit * num_pages)), "next_offset overlapped previous run."

        export_replay_row_set_async.delay(
            project_id=project_id,
            start=start,
            end=end,
            limit=limit,
            offset=next_offset,
            destination_bucket=destination_bucket,
            max_rows_to_export=max_rows_to_export,
            num_pages=num_pages,
        )


@instrumented_task(
    name="sentry.replays.tasks.export_replay_project_async",
    namespace=replays_tasks,
)
def export_replay_project_async(
    project_id: int,
    limit: int,
    destination_bucket: str,
    num_pages: int = EXPORT_QUERY_PAGES_PER_TASK,
):
    """
    Export every replay for a given Sentry Project ID.

    A task will be spawned for each day and will export that day's rows. This means we have a
    maximum parallelism of 90 simultaneous processes. This value may be lower given the demand on
    the task broker itself. If more parallelism is desired you will need to tweak the granularity
    of the `get_replay_date_query_ranges` query.

    :param project_id: Sentry Project ID.
    :param limit: The maximum number of rows to query for in any given replay.
    :param destination_bucket:
    :param num_pages: The maximum number of pages to query for within a single task execution.
    """
    # Each populated day bucket is scheduled for export.
    for start, end, max_rows_to_export in get_replay_date_query_ranges(project_id):
        export_replay_row_set_async.delay(
            project_id=project_id,
            start=start,
            end=end,
            destination_bucket=destination_bucket,
            max_rows_to_export=max_rows_to_export,
            limit=limit,
            offset=0,
            num_pages=num_pages,
        )


def export_replay_blob_data[T](
    project_id: int,
    gcp_project_id: str,
    destination_bucket: str,
    destination_prefix: str,
    do_create_transfer_job: Callable[[CreateTransferJobRequest], T],
    pubsub_topic_name: str | None = None,
    source_bucket: str = EXPORT_JOB_SOURCE_BUCKET,
) -> list[T]:
    # In the future we could set a non-unique transfer-job name. This would prevent duplicate runs
    # from doing the same work over and over again. However, we'd need to catch the exception,
    # look-up any active runs, and, if no active runs, schedule a new run. This is a bit much for
    # now.
    #
    # transfer_job_name = f"{source_bucket}/{project_id}/{start_date_rounded_to_day}"
    jobs = []
    for retention_days in (30, 60, 90):
        jobs.append(
            create_transfer_job(
                gcp_project_id=gcp_project_id,
                transfer_job_name=None,
                source_bucket=source_bucket,
                source_prefix=f"{retention_days}/{project_id}/",
                destination_bucket=destination_bucket,
                destination_prefix=destination_prefix,
                notification_topic=pubsub_topic_name,
                job_description="Session Replay EU Compliance Export",
                do_create_transfer_job=do_create_transfer_job,
            )
        )
    return jobs


def export_replay_data(
    organization_id: int,
    gcp_project_id: str,
    destination_bucket: str,
    destination_prefix: str,
    database_rows_per_page: int = EXPORT_QUERY_ROWS_PER_PAGE,
    database_pages_per_task: int = EXPORT_QUERY_PAGES_PER_TASK,
    source_bucket: str = EXPORT_JOB_SOURCE_BUCKET,
    pubsub_topic_name: str | None = None,
):
    logger.info(
        "Starting replay export...",
        extra={
            "organization_id": organization_id,
            "gcp_project_id": gcp_project_id,
            "destination_bucket": destination_bucket,
            "database_rows_per_page": database_rows_per_page,
            "database_pages_per_task": database_pages_per_task,
            "source_bucket": source_bucket,
            "pubsub_topic_name": pubsub_topic_name,
        },
    )

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
            gcp_project_id=gcp_project_id,
            destination_bucket=destination_bucket,
            destination_prefix=destination_prefix,
            pubsub_topic_name=pubsub_topic_name,
            source_bucket=source_bucket,
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
