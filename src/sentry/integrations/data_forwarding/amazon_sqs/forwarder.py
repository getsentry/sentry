from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

import boto3
import orjson
from botocore.client import Config
from botocore.exceptions import ClientError, ParamValidationError

from sentry.api.serializers import serialize
from sentry.integrations.data_forwarding.base import BaseDataForwarder
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.services.eventstore.models import Event, GroupEvent

logger = logging.getLogger(__name__)

# AWS SQS maximum message size limit
AWS_SQS_MAX_MESSAGE_SIZE = 256 * 1024  # 256 KB


class AmazonSQSForwarder(BaseDataForwarder):
    provider = DataForwarderProviderSlug.SQS
    rate_limit = (0, 0)

    def get_event_payload(
        self, event: Event | GroupEvent, config: dict[str, Any]
    ) -> dict[str, Any]:
        return serialize(event)

    def is_unrecoverable_client_error(self, error: ClientError) -> bool:
        error_str = str(error)

        # Invalid or missing AWS credentials
        if error_str.startswith(
            (
                "An error occurred (InvalidClientTokenId)",
                "An error occurred (AccessDenied)",
                "An error occurred (InvalidAccessKeyId)",
            )
        ):
            return True

        # Missing MessageGroupId for FIFO queue
        if error_str.endswith("must contain the parameter MessageGroupId."):
            return True

        # S3 bucket errors
        if error_str.startswith(
            (
                "An error occurred (NoSuchBucket)",
                "An error occurred (IllegalLocationConstraintException)",
            )
        ):
            return True

        # Non-existent SQS queue
        if "AWS.SimpleQueueService.NonExistentQueue" in error_str:
            return True

        return False

    def forward_event(
        self,
        event: Event | GroupEvent,
        payload: dict[str, Any],
        config: dict[str, Any],
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

            # need a MessageGroupId for FIFO queues
            # note that if MessageGroupId is specified for non-FIFO, this will fail
            if message_group_id:
                send_message_args["MessageGroupId"] = message_group_id

                # if content based de-duplication is not enabled, we need to provide a
                # MessageDeduplicationId
                send_message_args["MessageDeduplicationId"] = uuid4().hex
            return client.send_message(**send_message_args)

        # Upload to S3 if configured (for large payloads)
        if s3_bucket:
            try:
                date = event.datetime.strftime("%Y-%m-%d")
                key = f"{event.project.slug}/{date}/{event.event_id}"
                s3_put_object(
                    Bucket=s3_bucket,
                    Body=orjson.dumps(payload, option=orjson.OPT_UTC_Z).decode(),
                    Key=key,
                )

                url = f"https://{s3_bucket}.s3.{region}.amazonaws.com/{key}"
                payload = {"s3Url": url, "eventID": event.event_id}

            except ClientError as e:
                if self.is_unrecoverable_client_error(e):
                    return False
                raise
            except ParamValidationError:
                # Invalid bucket name
                return False

        message = orjson.dumps(payload, option=orjson.OPT_UTC_Z).decode()

        if len(message) > AWS_SQS_MAX_MESSAGE_SIZE:
            return False

        # Send message to SQS
        try:
            sqs_send_message(message)
        except ClientError as e:
            if self.is_unrecoverable_client_error(e):
                return False
            raise

        return True
