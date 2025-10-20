from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError, ParamValidationError

from data_forwarding.base import DataForwardingPlugin
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.services.eventstore.models import Event
from sentry.utils import json

logger = logging.getLogger(__name__)

DESCRIPTION = """
Send Sentry events to Amazon SQS.

This integration allows you to forward Sentry events to an Amazon SQS queue for further processing.

Amazon SQS is a fully managed message queuing service that enables you to decouple and scale microservices.
"""


class AmazonSQSDataForwarder(DataForwardingPlugin):
    provider = DataForwarderProviderSlug.SQS
    name = "Amazon SQS"
    description = DESCRIPTION

    def get_rate_limit(self) -> tuple[int, int]:
        return (0, 0)

    def get_event_payload(self, event: Event) -> dict[str, Any]:
        return dict(event.data)

    def send_payload(
        self,
        payload: dict[str, Any],
        config: dict[str, Any],
        event: Event,
        data_forwarder_project: DataForwarderProject,
    ) -> bool:
        queue_url = config["queue_url"]
        region = config["region"]
        access_key = config["access_key"]
        secret_key = config["secret_key"]
        message_group_id = config.get("message_group_id")
        s3_bucket = config.get("s3_bucket")

        boto3_args = {
            "aws_access_key_id": access_key,
            "aws_secret_access_key": secret_key,
            "region_name": region,
        }

        def s3_put_object(*args, **kwargs):
            s3_client = boto3.client(
                service_name="s3", config=Config(signature_version="s3v4"), **boto3_args
            )
            return s3_client.put_object(*args, **kwargs)

        def sqs_send_message(message):
            client = boto3.client(service_name="sqs", **boto3_args)
            send_message_args = {"QueueUrl": queue_url, "MessageBody": message}
            if message_group_id:
                send_message_args["MessageGroupId"] = message_group_id
                send_message_args["MessageDeduplicationId"] = uuid4().hex
            return client.send_message(**send_message_args)

        try:
            if s3_bucket:
                date = event.datetime.strftime("%Y-%m-%d")
                key = f"{event.project.slug}/{date}/{event.event_id}"
                s3_put_object(Bucket=s3_bucket, Body=json.dumps(payload), Key=key)

                url = f"https://{s3_bucket}.s3-{region}.amazonaws.com/{key}"
                payload = {"s3Url": url, "eventID": event.event_id}

            message = json.dumps(payload)

            if len(message) > 256 * 1024:
                return False

            sqs_send_message(message)

        except ClientError as e:
            if (
                str(e).startswith("An error occurred (InvalidClientTokenId)")
                or str(e).startswith("An error occurred (AccessDenied)")
                or str(e).startswith("An error occurred (InvalidAccessKeyId)")
            ):
                return False
            elif str(e).endswith("must contain the parameter MessageGroupId."):
                return False
            elif str(e).startswith("An error occurred (NoSuchBucket)") or str(e).startswith(
                "An error occurred (IllegalLocationConstraintException)"
            ):
                return False
            elif "AWS.SimpleQueueService.NonExistentQueue" in str(e):
                return False
            raise
        except ParamValidationError:
            return False
        return True
