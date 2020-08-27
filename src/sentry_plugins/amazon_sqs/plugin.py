from __future__ import absolute_import

import logging

import six
import boto3
from botocore.client import ClientError

from sentry_plugins.base import CorePluginMixin
from sentry.plugins.bases.data_forwarding import DataForwardingPlugin
from sentry_plugins.utils import get_secret_field_config
from sentry.utils import json, metrics
from sentry.integrations import FeatureDescription, IntegrationFeatures

logger = logging.getLogger(__name__)

DESCRIPTION = """
Forward Sentry events to Amazon SQS.

Amazon Simple Queue Service (SQS) is a fully managed message
queuing service that enables you to decouple and scale microservices,
distributed systems, and serverless applications.
"""


def get_regions():
    public_region_list = boto3.session.Session().get_available_regions("sqs")
    cn_region_list = boto3.session.Session().get_available_regions("sqs", partition_name="aws-cn")
    return public_region_list + cn_region_list


def map_reduced_sqs_payload(payload, url):
    params_to_pass = ["eventID", "projectID", "message", "id", "size"]
    new_payload = {"s3Url": url}
    for param in params_to_pass:
        new_payload[param] = payload[param]
    return new_payload


def track_response_metric(fn):
    # https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/sqs.html#SQS.Queue.send_message
    # boto3's send_message doesn't return success/fail or http codes
    # success is a boolean based on whether there was an exception or not
    def wrapper(*args, **kwargs):
        try:
            success = fn(*args, **kwargs)
            metrics.incr(
                "data-forwarding.http_response", tags={"plugin": "amazon-sqs", "success": success}
            )
        except Exception:
            metrics.incr(
                "data-forwarding.http_response", tags={"plugin": "amazon-sqs", "success": False}
            )
            raise
        return success

    return wrapper


class AmazonSQSPlugin(CorePluginMixin, DataForwardingPlugin):
    title = "Amazon SQS"
    slug = "amazon-sqs"
    description = DESCRIPTION
    conf_key = "amazon-sqs"
    required_field = "queue_url"
    feature_descriptions = [
        FeatureDescription(
            """
            Forward Sentry errors and events to Amazon SQS.
            """,
            IntegrationFeatures.DATA_FORWARDING,
        )
    ]

    def get_config(self, project, **kwargs):
        return [
            {
                "name": "queue_url",
                "label": "Queue URL",
                "type": "url",
                "placeholder": "https://sqs-us-east-1.amazonaws.com/12345678/myqueue",
            },
            {
                "name": "region",
                "label": "Region",
                "type": "select",
                "choices": tuple((z, z) for z in get_regions()),
            },
            {
                "name": "access_key",
                "label": "Access Key",
                "type": "text",
                "placeholder": "Access Key",
            },
            get_secret_field_config(
                name="secret_key", label="Secret Key", secret=self.get_option("secret_key", project)
            ),
            {
                "name": "message_group_id",
                "label": "Message Group ID",
                "type": "text",
                "required": False,
                "placeholder": "Required for FIFO queues, exclude for standard queues",
            },
            {
                "name": "s3_bucket",
                "label": "S3 Bucket",
                "type": "text",
                "required": False,
                "placeholder": "s3-bucket",
                "help": (
                    "Specify an S3 bucket to avoid events from being rejected because they are over the 256Kb limit for SQS."
                    " The payload of the SQS item will contain a reference to the item in S3."
                ),
            },
        ]

    @track_response_metric
    def forward_event(self, event, payload):
        queue_url = self.get_option("queue_url", event.project)
        access_key = self.get_option("access_key", event.project)
        secret_key = self.get_option("secret_key", event.project)
        region = self.get_option("region", event.project)
        message_group_id = self.get_option("message_group_id", event.project)

        # the metrics tags are a subset of logging params
        metric_tags = {
            "project_id": event.project_id,
            "organization_id": event.project.organization_id,
        }
        logging_params = metric_tags.copy()
        logging_params["event_id"] = event.event_id
        logging_params["issue_id"] = event.group_id

        if not all((queue_url, access_key, secret_key, region)):
            logger.info("sentry_plugins.amazon_sqs.skip_unconfigured", extra=logging_params)
            return

        boto3_args = {
            "aws_access_key_id": access_key,
            "aws_secret_access_key": secret_key,
            "region_name": region,
        }

        def s3_put_object(*args, **kwargs):
            s3_client = boto3.client(service_name="s3", **boto3_args)
            return s3_client.put_object(*args, **kwargs)

        def sqs_send_message(message):
            client = boto3.client(service_name="sqs", **boto3_args)
            send_message_args = {"QueueUrl": queue_url, "MessageBody": message}
            # need a MessageGroupId for FIFO queues
            # note that if MessageGroupId is specified for non-FIFO, this will fail
            if message_group_id:
                from uuid import uuid4

                send_message_args["MessageGroupId"] = message_group_id
                # if content based de-duplication is not enabled, we need to provide a
                # MessageDeduplicationId
                send_message_args["MessageDeduplicationId"] = uuid4().hex
            return client.send_message(**send_message_args)

        # wrap S3 put_object and and SQS send message in one try/except
        s3_bucket = self.get_option("s3_bucket", event.project)
        try:
            # if we have an S3 bucket, upload to S3
            if s3_bucket:
                date = event.datetime.strftime("%Y-%m-%d")
                key = "{}/{}/{}".format(event.project.slug, date, event.event_id)
                s3_put_object(Bucket=s3_bucket, Body=json.dumps(payload), Key=key)

                url = u"https://{}.s3-{}.amazonaws.com/{}".format(s3_bucket, region, key)
                # use a reduced payload for SQS now
                payload = map_reduced_sqs_payload(payload, url)

            message = json.dumps(payload)

            if len(message) > 256 * 1024:
                logger.info("sentry_plugins.amazon_sqs.skip_oversized", extra=logging_params)
                return False

            sqs_send_message(message)
        except ClientError as e:
            if six.text_type(e).startswith(
                "An error occurred (InvalidClientTokenId)"
            ) or six.text_type(e).startswith("An error occurred (AccessDenied)"):
                # If there's an issue with the user's token then we can't do
                # anything to recover. Just log and continue.
                metrics_name = "sentry_plugins.amazon_sqs.access_token_invalid"
                logger.info(
                    metrics_name, extra=logging_params,
                )

                metrics.incr(
                    metrics_name, tags=metric_tags,
                )
                return False
            elif six.text_type(e).endswith("must contain the parameter MessageGroupId."):
                metrics_name = "sentry_plugins.amazon_sqs.missing_message_group_id"
                logger.info(
                    metrics_name, extra=logging_params,
                )
                metrics.incr(
                    metrics_name, tags=metric_tags,
                )
                return False
            raise
        return True
