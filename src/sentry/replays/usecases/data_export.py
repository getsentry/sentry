#  $$$$$$\  $$\       $$$$$$\  $$$$$$\  $$\   $$\ $$\   $$\  $$$$$$\  $$\   $$\  $$$$$$\  $$$$$$$$\
# $$  __$$\ $$ |      \_$$  _|$$  __$$\ $$ | $$  |$$ |  $$ |$$  __$$\ $$ |  $$ |$$  __$$\ $$  _____|
# $$ /  \__|$$ |        $$ |  $$ /  \__|$$ |$$  / $$ |  $$ |$$ /  $$ |$$ |  $$ |$$ /  \__|$$ |
# $$ |      $$ |        $$ |  $$ |      $$$$$  /  $$$$$$$$ |$$ |  $$ |$$ |  $$ |\$$$$$$\  $$$$$\
# $$ |      $$ |        $$ |  $$ |      $$  $$<   $$  __$$ |$$ |  $$ |$$ |  $$ | \____$$\ $$  __|
# $$ |  $$\ $$ |        $$ |  $$ |  $$\ $$ |\$$\  $$ |  $$ |$$ |  $$ |$$ |  $$ |$$\   $$ |$$ |
# \$$$$$$  |$$$$$$$$\ $$$$$$\ \$$$$$$  |$$ | \$$\ $$ |  $$ | $$$$$$  |\$$$$$$  |\$$$$$$  |$$$$$$$$\
#  \______/ \________|\______| \______/ \__|  \__|\__|  \__| \______/  \______/  \______/ \________|

import csv
import io
from collections.abc import Callable, Generator, Iterator
from datetime import datetime
from typing import Any, Protocol

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

from sentry.utils.retries import ConditionalRetryPolicy
from sentry.utils.snuba import raw_snql_query


class QueryFnProtocol(Protocol):
    def __call__(self, limit: int, offset: int) -> Request: ...


def row_iterator_to_csv(rows: Iterator[dict[str, Any]]) -> io.BytesIO:
    buf = io.BytesIO()
    writer = csv.writer(buf)

    for i, row in enumerate(rows):
        if i == 0:
            writer.writerow(row.keys())

        writer.writerow(row.values())

    return buf


def export_clickhouse_rows(
    query_fn: QueryFnProtocol,
    referrer: str = "sentry.internal.eu-compliance-data-export",
    limit: int = 1000,
    offset: int = 0,
    num_pages: int = 1,
    max_retries: int = 10,
    retry_after_seconds: float = 1.0,
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
    assert limit > 0, "limit mut be a positive integer greater than zero."
    assert max_retries >= 0, "max_retries mut be a positive integer greater than or equal to zero."
    assert num_pages > 0, "num_pages mut be a positive integer greater than zero."
    assert offset >= 0, "offset mut be a positive integer greater than or equal to zero."
    assert (
        retry_after_seconds >= 0
    ), "retry_after_seconds mut be a positive float greater than or equal to zero."

    # Rate-limits might derail our queries. This policy will let us retry up to a maximum before
    # giving up. Should we ever give up on a data-export? Probably but the specifics of that
    # question are better answered elsewhere.
    policy = ConditionalRetryPolicy(
        test_function=lambda a, _: a <= max_retries,
        delay_function=lambda _: retry_after_seconds,
    )

    # Iteration is capped to a maximum number of pages. This ensures termination and encourages
    # appropriate bounding by the calling function. Ideally this export is ran in an asynchonrous
    # task. Tasks typically have a deadline so iterating forever is undesireable. Each task should
    # process a chunk of data commit it (and perhaps its progress) and then schedule another task
    # to complete the remainder of the job which itself is bounded.
    for _ in range(num_pages):
        request = query_fn(limit=limit, offset=offset)
        results = policy(lambda: raw_snql_query(request, referrer)["data"])
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


import base64
from datetime import datetime, timedelta, timezone

from google.cloud import storage_transfer_v1
from google.cloud.storage_transfer_v1 import (
    CreateTransferJobRequest,
    GcsData,
    NotificationConfig,
    Schedule,
    TransferJob,
    TransferSpec,
    UpdateTransferJobRequest,
)
from google.type import date_pb2

from sentry.utils import json


def request_schedule_transfer_job(transfer_job: dict[str, Any]) -> Any:
    client = storage_transfer_v1.StorageTransferServiceClient()
    return client.create_transfer_job(transfer_job=transfer_job)


def export_blob_data[T](
    gcs_project_id: str,
    source_bucket: str,
    source_prefix: str,
    destination_bucket: str,
    job_duration: timedelta,
    pubsub_topic_name: str | None = None,
    schedule_transfer_job: Callable[[CreateTransferJobRequest], T] = request_schedule_transfer_job,
    get_current_datetime: Callable[[], datetime] = lambda: datetime.now(tz=timezone.utc),
) -> T:
    """
    Schedule a transfer job copying the prefix.

    Failure notifications are handled by pubsub. When the transfer service fails it will send a
    notification to the specified topic. That topic should be configured to propagate the failure
    notice to our HTTP endpoint which will then call the appropriate retry function.

    :param gcs_project_id:
    :param source_bucket:
    :param source_prefix:
    :param destination_bucket:
    :param pubsub_topic_name:
    :param job_duration:
    :param schedule_transfer_job: An injected function which manages the service interaction.
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

    if pubsub_topic_name:
        transfer_job.notification_config = NotificationConfig(
            pubsub_topic=pubsub_topic_name,
            event_types=[NotificationConfig.EventType.TRANSFER_OPERATION_FAILED],
            payload_format=NotificationConfig.PayloadFormat.JSON,
        )

    request = CreateTransferJobRequest(transfer_job=transfer_job)

    return schedule_transfer_job(request)


def request_retry_transfer_job(request: UpdateTransferJobRequest) -> None:
    client = storage_transfer_v1.StorageTransferServiceClient()
    client.update_transfer_job(request)


def retry_export_blob_data[T](
    event: dict[str, Any],
    retry_transfer_job: Callable[[UpdateTransferJobRequest], T] = request_retry_transfer_job,
) -> T:
    """
    Retry data export.

    :param event:
    :param retry_transfer_job:
    """
    if "data" not in event:
        return

    # Decode the Pub/Sub message payload
    message = base64.b64decode(event["data"]).decode("utf-8")
    payload = json.loads(message)

    # Check for a failed transfer operation
    if "transferOperation" in payload and payload["transferOperation"]["status"] == "FAILED":
        job_name = payload["transferOperation"]["transferJobName"]
        gcs_project_id = payload["transferOperation"]["projectId"]

        request = UpdateTransferJobRequest(
            job_name=job_name,
            project_id=gcs_project_id,
            transfer_job=TransferJob(status=storage_transfer_v1.TransferJob.Status.ENABLED),
        )
        return retry_transfer_job(request)


# $$$$$$$\  $$$$$$$$\ $$$$$$$\  $$\        $$$$$$\ $$\     $$\
# $$  __$$\ $$  _____|$$  __$$\ $$ |      $$  __$$\\$$\   $$  |
# $$ |  $$ |$$ |      $$ |  $$ |$$ |      $$ /  $$ |\$$\ $$  /
# $$$$$$$  |$$$$$\    $$$$$$$  |$$ |      $$$$$$$$ | \$$$$  /
# $$  __$$< $$  __|   $$  ____/ $$ |      $$  __$$ |  \$$  /
# $$ |  $$ |$$ |      $$ |      $$ |      $$ |  $$ |   $$ |
# $$ |  $$ |$$$$$$$$\ $$ |      $$$$$$$$\ $$ |  $$ |   $$ |
# \__|  \__|\________|\__|      \________|\__|  \__|   \__|
import uuid


def export_replays_dataset(
    project_id: int,
    start: datetime,
    end: datetime,
    limit: int,
    offset: int,
) -> Request:
    assert start < end, "Start date must be less than the ending date."
    assert project_id > 0, "Project ID must be greater than zero."
    assert limit > 0, "limit mut be a positive integer greater than zero."
    assert offset >= 0, "offset mut be a positive integer greater than or equal to zero."

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
            Column("tags"),
            Column("tags"),
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


# $$$$$$\ $$\      $$\ $$$$$$$\  $$\
# \_$$  _|$$$\    $$$ |$$  __$$\ $$ |
#   $$ |  $$$$\  $$$$ |$$ |  $$ |$$ |
#   $$ |  $$\$$\$$ $$ |$$$$$$$  |$$ |
#   $$ |  $$ \$$$  $$ |$$  ____/ $$ |
#   $$ |  $$ |\$  /$$ |$$ |      $$ |
# $$$$$$\ $$ | \_/ $$ |$$ |      $$$$$$$$\
# \______|\__|     \__|\__|      \________|

from django.db.models import F

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.replays.tasks.export_clickhouse_rows_async")
def export_clickhouse_rows_async(
    project_id: int,
    start: datetime,
    end: datetime,
    limit: int,
    initial_offset: int,
    destination_bucket: str,
):
    row_iterator = export_clickhouse_rows(
        lambda limit, offset: export_replays_dataset(project_id, start, end, limit, offset),
        limit=limit,
        offset=initial_offset,
        num_pages=10,
    )

    file_name = f"replay-row-data/{uuid.uuid4().hex}"
    csv_bytes = row_iterator_to_csv(row_iterator)
    write_to_bucket(destination_bucket, file_name, csv_bytes)


@instrumented_task(name="sentry.replays.tasks.export_replay_clickhouse_data_async")
def export_replay_clickhouse_data_async(project_id: int, limit: int, destination_bucket: str):
    def generate_ninety_days_pairs() -> Iterator[tuple[datetime, datetime]]:
        now = datetime.now(tz=timezone.utc)

        start = datetime(year=now.year, month=now.month, day=now.day) - timedelta(days=89)
        end = start + timedelta(days=1)
        for _ in range(90):
            yield (start, end)
            start = start + timedelta(days=1)
            end = end + timedelta(days=1)

    for start, end in generate_ninety_days_pairs():
        export_clickhouse_rows_async.delay(
            project_id=project_id,
            start=start,
            end=end,
            limit=limit,
            initial_offset=0,
            destination_bucket=destination_bucket,
        )


def export_replay_blob_data(
    project_id: int,
    gcs_project_id: str,
    destination_bucket: str,
    job_duration: timedelta,
    pubsub_topic_name: str | None = None,
    source_bucket: str = "sentry-replays",
):
    for retention_days in (30, 60, 90):
        export_blob_data(
            gcs_project_id=gcs_project_id,
            source_bucket=source_bucket,
            source_prefix=f"{retention_days}/{project_id}",
            destination_bucket=destination_bucket,
            pubsub_topic_name=pubsub_topic_name,
            job_duration=job_duration,
        )


def export_replay_data(
    organization_id: int,
    destination_bucket: str,
    gcs_project_id: int,
    job_duration: timedelta,
    source_bucket: str = "sentry-replays",
    pubsub_topic_name: str | None = None,
):
    # Assert the organization exists.
    organization = Organization.objects.filter(organization_id=organization_id).get()

    # Fetch the organization's projects.
    projects = Project.objects.filter(
        organization=organization,
        flags=F("flags").bitor(Project.flags.has_replays),
    )

    for project in projects:
        export_replay_blob_data(
            project_id=project.id,
            gcs_project_id=gcs_project_id,
            destination_bucket=destination_bucket,
            pubsub_topic_name=pubsub_topic_name,
            source_bucket=source_bucket,
            job_duration=job_duration,
        )

    for project in projects:
        export_replay_clickhouse_data_async.delay(
            project_id=project.id,
            limit=1000,
            destination_bucket=destination_bucket,
        )
