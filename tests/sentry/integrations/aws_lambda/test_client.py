from unittest.mock import MagicMock, patch

import boto3

from sentry.integrations.aws_lambda.client import gen_aws_client
from sentry.testutils import TestCase
from sentry.testutils.helpers.faux import Mock
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test(stable=True)
class AwsLambdaClientTest(TestCase):
    @patch.object(boto3, "Session")
    @patch.object(boto3, "client")
    def test_simple(self, mock_get_client, mock_get_session):
        account_number = "599817902985"
        region = "us-west-1"
        aws_external_id = "124-343"

        mock_client = Mock()
        mock_get_client.return_value = mock_client
        credentials = {
            "AccessKeyId": "my_access_key_id",
            "SecretAccessKey": "my_secret_access_key",
            "SessionToken": "my_session_token",
        }
        mock_client.assume_role = MagicMock(return_value={"Credentials": credentials})

        mock_session = Mock()
        mock_session.client = MagicMock(return_value="expected_output")

        mock_get_session.return_value = mock_session

        assert "expected_output" == gen_aws_client(account_number, region, aws_external_id)

        mock_get_client.assert_called_once_with(
            service_name="sts",
            aws_access_key_id="aws-key-id",
            aws_secret_access_key="aws-secret-access-key",
            region_name="us-east-2",
        )

        role_arn = "arn:aws:iam::599817902985:role/SentryRole"

        mock_client.assume_role.assert_called_once_with(
            RoleSessionName="Sentry",
            RoleArn=role_arn,
            ExternalId=aws_external_id,
            Policy=json.dumps(
                {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Action": ["lambda:UpdateFunctionConfiguration", "lambda:GetFunction"],
                            "Resource": "arn:aws:lambda:us-west-1:599817902985:function:*",
                        },
                        {
                            "Effect": "Allow",
                            "Action": [
                                "lambda:ListFunctions",
                                "lambda:ListLayerVersions",
                                "lambda:GetLayerVersion",
                                "organizations:DescribeAccount",
                            ],
                            "Resource": "*",
                        },
                    ],
                }
            ),
        )

        mock_get_session.assert_called_once_with(
            aws_access_key_id=credentials["AccessKeyId"],
            aws_secret_access_key=credentials["SecretAccessKey"],
            aws_session_token=credentials["SessionToken"],
        )

        mock_session.client.assert_called_once_with(service_name="lambda", region_name="us-west-1")
