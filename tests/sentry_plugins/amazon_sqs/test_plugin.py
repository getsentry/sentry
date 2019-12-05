from __future__ import absolute_import

from botocore.client import ClientError
from exam import fixture
from mock import patch

from sentry.testutils import PluginTestCase
from sentry.utils import json

from sentry_plugins.amazon_sqs.plugin import AmazonSQSPlugin


class AmazonSQSPluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return AmazonSQSPlugin()

    def test_conf_key(self):
        assert self.plugin.conf_key == "amazon-sqs"

    def test_entry_point(self):
        self.assertPluginInstalled("amazon_sqs", self.plugin)

    def run_test(self):
        self.plugin.set_option("access_key", "access-key", self.project)
        self.plugin.set_option("secret_key", "secret-key", self.project)
        self.plugin.set_option("region", "us-east-1", self.project)
        self.plugin.set_option(
            "queue_url", "https://sqs-us-east-1.amazonaws.com/12345678/myqueue", self.project
        )

        event = self.store_event(
            data={
                "sentry.interfaces.Exception": {"type": "ValueError", "value": "foo bar"},
                "sentry.interfaces.User": {"id": "1", "email": "foo@example.com"},
                "type": "error",
                "metadata": {"type": "ValueError", "value": "foo bar"},
            },
            project_id=self.project.id,
        )

        with self.options({"system.url-prefix": "http://example.com"}):
            self.plugin.post_process(event)
        return event

    @patch("boto3.client")
    def test_simple_notification(self, mock_client):
        event = self.run_test()
        mock_client.assert_called_once_with(
            service_name="sqs",
            region_name="us-east-1",
            aws_access_key_id="access-key",
            aws_secret_access_key="secret-key",
        )
        mock_client.return_value.send_message.assert_called_once_with(
            QueueUrl="https://sqs-us-east-1.amazonaws.com/12345678/myqueue",
            MessageBody=json.dumps(self.plugin.get_event_payload(event)),
        )

    @patch("sentry_plugins.amazon_sqs.plugin.logger")
    @patch("boto3.client")
    def test_token_error(self, mock_client, logger):
        mock_client.return_value.send_message.side_effect = ClientError(
            {"Error": {"Code": "Hello", "Message": "hello"}}, "SendMessage"
        )
        with self.assertRaises(ClientError):
            self.run_test()
        assert not logger.info.called

        mock_client.return_value.send_message.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Hello"}}, "SendMessage"
        )
        self.run_test()
        assert len(logger.info.call_args_list) == 1
        assert (
            logger.info.call_args_list[0][0][0] == "sentry_plugins.amazon_sqs.access_token_invalid"
        )

    @patch("sentry_plugins.amazon_sqs.plugin.logger")
    @patch("boto3.client")
    def test_message_group_error(self, mock_client, logger):
        mock_client.return_value.send_message.side_effect = ClientError(
            {
                "Error": {
                    "Code": "MissingParameter",
                    "Message": "The request must contain the parameter MessageGroupId.",
                }
            },
            "SendMessage",
        )

        self.run_test()

        assert len(logger.info.call_args_list) == 1
        assert (
            logger.info.call_args_list[0][0][0]
            == "sentry_plugins.amazon_sqs.missing_message_group_id"
        )

    @patch("uuid.uuid4")
    @patch("boto3.client")
    def test_pass_message_group_id(self, mock_client, mock_uuid):
        class uuid(object):
            hex = "some-uuid"

        mock_uuid.return_value = uuid
        self.plugin.set_option("message_group_id", "my_group", self.project)
        event = self.run_test()

        mock_client.return_value.send_message.assert_called_once_with(
            QueueUrl="https://sqs-us-east-1.amazonaws.com/12345678/myqueue",
            MessageBody=json.dumps(self.plugin.get_event_payload(event)),
            MessageGroupId="my_group",
            MessageDeduplicationId="some-uuid",
        )
