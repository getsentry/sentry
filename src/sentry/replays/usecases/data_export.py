#  $$$$$$\  $$\       $$$$$$\  $$$$$$\  $$\   $$\ $$\   $$\  $$$$$$\  $$\   $$\  $$$$$$\  $$$$$$$$\
# $$  __$$\ $$ |      \_$$  _|$$  __$$\ $$ | $$  |$$ |  $$ |$$  __$$\ $$ |  $$ |$$  __$$\ $$  _____|
# $$ /  \__|$$ |        $$ |  $$ /  \__|$$ |$$  / $$ |  $$ |$$ /  $$ |$$ |  $$ |$$ /  \__|$$ |
# $$ |      $$ |        $$ |  $$ |      $$$$$  /  $$$$$$$$ |$$ |  $$ |$$ |  $$ |\$$$$$$\  $$$$$\
# $$ |      $$ |        $$ |  $$ |      $$  $$<   $$  __$$ |$$ |  $$ |$$ |  $$ | \____$$\ $$  __|
# $$ |  $$\ $$ |        $$ |  $$ |  $$\ $$ |\$$\  $$ |  $$ |$$ |  $$ |$$ |  $$ |$$\   $$ |$$ |
# \$$$$$$  |$$$$$$$$\ $$$$$$\ \$$$$$$  |$$ | \$$\ $$ |  $$ | $$$$$$  |\$$$$$$  |\$$$$$$  |$$$$$$$$\
#  \______/ \________|\______| \______/ \__|  \__|\__|  \__| \______/  \______/  \______/ \________|

from collections.abc import Callable
from datetime import datetime
from typing import Any, TypedDict

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
)

from sentry.replays.usecases.query import execute_query


class Cursor(TypedDict):
    event_hash: str
    replay_id: str


def export_clickhouse_rows(
    project_ids: list[int],
    start: datetime,
    end: datetime,
    limit: int = 1000,
    num_pages: int = 1,
):
    offset = 0
    for _ in range(num_pages):
        results = export_clickhouse_row_set(project_ids, start, end, limit, offset)
        offset += len(results)

        if results:
            yield results

        if len(results) != limit:
            break


def export_clickhouse_row_set(
    project_ids: list[int],
    start: datetime,
    end: datetime,
    limit: int,
    offset: int,
) -> dict[str, Any]:
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
            Condition(Column("project_id"), Op.IN, project_ids),
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

    return execute_query(query, {}, "replays.compliance_data_export")["data"]


def hash_(value: Column | str) -> Function:
    return Function("cityHash64", parameters=[value])


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


def export_projects_replay_blob_data(
    project_ids: list[int],
    gcs_project_id: str,
    destination_bucket: str,
    pubsub_topic_name: str,
    source_bucket: str = "sentry-replays",
    job_duration: timedelta | None = None,
):
    job_duration = job_duration or timedelta(days=5)
    for project_id in project_ids:
        for retention_days in (30, 60, 90):
            export_blob_data(
                gcs_project_id=gcs_project_id,
                source_bucket=source_bucket,
                source_prefix=f"{retention_days}/{project_id}",
                destination_bucket=destination_bucket,
                pubsub_topic_name=pubsub_topic_name,
                job_duration=job_duration,
            )


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
