from unittest.mock import patch

import orjson
from botocore.exceptions import ClientError

from sentry.api.serializers import serialize
from sentry.integrations.data_forwarding.amazon_sqs.forwarder import AmazonSQSForwarder
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.testutils.cases import TestCase


class AmazonSQSDataForwarderTest(TestCase):
    def setUp(self):
        super().setUp()
        self.data_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            provider=DataForwarderProviderSlug.SQS,
            config={
                "queue_url": "https://sqs.us-east-1.amazonaws.com/12345678/myqueue",
                "region": "us-east-1",
                "access_key": "access-key",
                "secret_key": "secret-key",
            },
            is_enabled=True,
        )
        self.data_forwarder_project = DataForwarderProject.objects.create(
            data_forwarder=self.data_forwarder,
            project=self.project,
            is_enabled=True,
        )
        self.forwarder = AmazonSQSForwarder()

    @patch("boto3.client")
    def test_simple_notification(self, mock_client):
        event = self.store_event(
            data={
                "exception": {"type": "ValueError", "value": "foo bar"},
                "user": {"id": "1", "email": "foo@example.com"},
                "type": "error",
                "metadata": {"type": "ValueError", "value": "foo bar"},
            },
            project_id=self.project.id,
        )

        self.forwarder.post_process(event, self.data_forwarder_project)

        mock_client.assert_called_once_with(
            service_name="sqs",
            region_name="us-east-1",
            aws_access_key_id="access-key",
            aws_secret_access_key="secret-key",
        )
        mock_client.return_value.send_message.assert_called_once_with(
            QueueUrl="https://sqs.us-east-1.amazonaws.com/12345678/myqueue",
            MessageBody=orjson.dumps(serialize(event), option=orjson.OPT_UTC_Z).decode(),
        )

    @patch("boto3.client")
    def test_token_error(self, mock_client):
        mock_client.return_value.send_message.side_effect = ClientError(
            {"Error": {"Code": "InvalidClientTokenId", "Message": "Invalid token"}},
            "SendMessage",
        )

        event = self.store_event(
            data={"exception": {"type": "ValueError", "value": "foo bar"}, "type": "error"},
            project_id=self.project.id,
        )

        self.forwarder.post_process(event, self.data_forwarder_project)

    @patch("boto3.client")
    def test_message_group_error(self, mock_client):
        mock_client.return_value.send_message.side_effect = ClientError(
            {
                "Error": {
                    "Code": "MissingParameter",
                    "Message": "The request must contain the parameter MessageGroupId.",
                }
            },
            "SendMessage",
        )

        event = self.store_event(
            data={"exception": {"type": "ValueError", "value": "foo bar"}, "type": "error"},
            project_id=self.project.id,
        )

        self.forwarder.post_process(event, self.data_forwarder_project)

    @patch("boto3.client")
    def test_pass_message_group_id(self, mock_client):
        self.data_forwarder.config["message_group_id"] = "my_group"
        self.data_forwarder.save()

        event = self.store_event(
            data={
                "exception": {"type": "ValueError", "value": "foo bar"},
                "type": "error",
            },
            project_id=self.project.id,
        )

        self.forwarder.post_process(event, self.data_forwarder_project)

        call_args = mock_client.return_value.send_message.call_args[1]
        assert call_args["MessageGroupId"] == "my_group"
        assert "MessageDeduplicationId" in call_args

    @patch("boto3.client")
    def test_use_s3_bucket(self, mock_client):
        self.data_forwarder.config["s3_bucket"] = "my_bucket"
        self.data_forwarder.save()

        event = self.store_event(
            data={
                "exception": {"type": "ValueError", "value": "foo bar"},
                "type": "error",
            },
            project_id=self.project.id,
        )

        self.forwarder.post_process(event, self.data_forwarder_project)

        mock_client.return_value.put_object.assert_called_once()
        put_object_call = mock_client.return_value.put_object.call_args[1]
        assert put_object_call["Bucket"] == "my_bucket"

        date = event.datetime.strftime("%Y-%m-%d")
        expected_key = f"{event.project.slug}/{date}/{event.event_id}"
        assert put_object_call["Key"] == expected_key

        send_message_call = mock_client.return_value.send_message.call_args[1]
        message_body = orjson.loads(send_message_call["MessageBody"])
        assert "s3Url" in message_body
        assert message_body["eventID"] == event.event_id

        # Verify S3 URL uses correct format with s3.{region} not s3-{region}
        expected_url = f"https://my_bucket.s3.us-east-1.amazonaws.com/{expected_key}"
        assert message_body["s3Url"] == expected_url
        assert "s3-" not in message_body["s3Url"]
