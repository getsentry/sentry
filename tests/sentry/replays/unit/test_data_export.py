import base64
from datetime import datetime

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

from sentry.replays.data_export import (
    create_transfer_job,
    export_replay_blob_data,
    retry_transfer_job_run,
)
from sentry.utils import json


def test_export_blob_data() -> None:
    # Function parameters which could be abstracted to test multiple variations of this behavior.
    gcs_project_id = "1"
    notification_topic = "PUBSUB_TOPIC"
    pubsub_topic = f"projects/{gcs_project_id}/topics/{notification_topic}"
    bucket_name = "BUCKET"
    bucket_prefix = "PREFIX"
    start_date = datetime(year=2025, month=1, day=31)
    job_description = "something"
    end_date = start_date

    result = create_transfer_job(
        gcp_project_id=gcs_project_id,
        source_bucket=bucket_name,
        source_prefix=bucket_prefix,
        destination_bucket="b",
        destination_prefix="destination_prefix/",
        notification_topic=notification_topic,
        job_description=job_description,
        transfer_job_name=None,
        do_create_transfer_job=lambda event: event,
        get_current_datetime=lambda: start_date,
    )

    assert result == CreateTransferJobRequest(
        transfer_job=TransferJob(
            description=job_description,
            project_id=gcs_project_id,
            status=storage_transfer_v1.TransferJob.Status.ENABLED,
            transfer_spec=TransferSpec(
                gcs_data_source=GcsData(bucket_name=bucket_name, path=bucket_prefix),
                gcs_data_sink=GcsData(bucket_name="b", path="destination_prefix/"),
            ),
            schedule=Schedule(
                schedule_start_date=date_pb2.Date(
                    year=start_date.year,
                    month=start_date.month,
                    day=start_date.day,
                ),
                schedule_end_date=date_pb2.Date(
                    year=end_date.year,
                    month=end_date.month,
                    day=end_date.day,
                ),
            ),
            notification_config=NotificationConfig(
                pubsub_topic=pubsub_topic,
                event_types=[
                    NotificationConfig.EventType.TRANSFER_OPERATION_FAILED,
                    NotificationConfig.EventType.TRANSFER_OPERATION_SUCCESS,
                    NotificationConfig.EventType.TRANSFER_OPERATION_ABORTED,
                ],
                payload_format=NotificationConfig.PayloadFormat.JSON,
            ),
        )
    )


def test_retry_export_blob_data() -> None:
    job_name = "job-name"
    job_project_id = "project-name"

    transfer_operation = {
        "transferOperation": {
            "status": "FAILED",
            "transferJobName": job_name,
            "projectId": job_project_id,
        }
    }

    result = retry_transfer_job_run(
        {"data": base64.b64encode(json.dumps(transfer_operation).encode()).decode("utf-8")},
        lambda request: request,
    )

    assert result == RunTransferJobRequest(job_name=job_name, project_id=job_project_id)


def test_export_replay_blob_data() -> None:
    jobs = []
    export_replay_blob_data(1, "1", "test", "dest_prefix/", lambda job: jobs.append(job))

    # Assert a job is created for each retention-period.
    assert len(jobs) == 3
    assert jobs[0].transfer_job.transfer_spec.gcs_data_source.path == "30/1/"
    assert jobs[1].transfer_job.transfer_spec.gcs_data_source.path == "60/1/"
    assert jobs[2].transfer_job.transfer_spec.gcs_data_source.path == "90/1/"
