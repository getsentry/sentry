from typing import TypedDict
from unittest.mock import MagicMock, patch

import boto3
import pytest
import responses
from django.test import override_settings
from responses import matchers
from rest_framework.decorators import api_view
from rest_framework.test import APIRequestFactory

from sentry.integrations.aws_lambda import AwsLambdaIntegrationProvider
from sentry.integrations.aws_lambda.client import AwsLambdaProxyClient, gen_aws_client
from sentry.models import Integration
from sentry.shared_integrations.client.proxy import get_proxy_url
from sentry.silo.base import SiloMode
from sentry.silo.util import (
    PROXY_BASE_PATH,
    PROXY_OI_HEADER,
    PROXY_SIGNATURE_HEADER,
    encode_subnet_signature,
)
from sentry.testutils import TestCase
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

        mock_client = mock_get_client.return_value
        credentials = {
            "AccessKeyId": "my_access_key_id",
            "SecretAccessKey": "my_secret_access_key",
            "SessionToken": "my_session_token",
        }
        mock_client.assume_role = MagicMock(return_value={"Credentials": credentials})

        mock_session = mock_get_session.return_value
        mock_session.client = MagicMock(return_value="expected_output")

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


def assert_proxy_request(request, is_proxy=True):
    assert (PROXY_BASE_PATH in request.url) == is_proxy
    assert (PROXY_OI_HEADER in request.headers) == is_proxy
    assert (PROXY_SIGNATURE_HEADER in request.headers) == is_proxy
    # AWS Lambda API does not require the Authorization header.
    # The secret is instead passed in the body payload called routing_key/integration key
    assert "Authorization" not in request.headers
    if is_proxy:
        assert request.headers[PROXY_OI_HEADER] is not None


class SiloHttpHeaders(TypedDict, total=False):
    HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION: str
    HTTP_X_SENTRY_SUBNET_SIGNATURE: str


SENTRY_SUBNET_SECRET = "hush-hush-im-invisible"


@override_settings(
    SENTRY_SUBNET_SECRET=SENTRY_SUBNET_SECRET,
    SENTRY_CONTROL_ADDRESS="http://controlserver",
)
class AwsLambdaProxyApiClientTest(TestCase):
    provider = AwsLambdaIntegrationProvider

    def setUp(self):
        self.login_as(self.user)
        self.account_number = "599817902985"
        self.region = "us-east-2"
        self.aws_external_id = "12-323"

        self.integration = Integration.objects.create(
            provider=self.provider.key,
            name=f"{self.account_number} {self.region}",
            external_id=f"{self.account_number}-{self.region}",
            metadata={
                "account_number": self.account_number,
                "region": self.region,
                "aws_external_id": self.aws_external_id,
            },
        )
        self.integration.add_organization(self.organization, self.user)
        self.installation = self.integration.get_installation(self.organization.id)

    @patch("sentry.integrations.aws_lambda.client.gen_aws_client")
    @responses.activate
    def test_integration_proxy_is_active(self, mock_gen_aws_client):
        expected_get_function_return = {
            "Configuration": {
                "FunctionName": "lambdaE",
                "Runtime": "python3.8",
                "Handler": "lambda_handler.test_handler",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaE",
                "Layers": ["arn:aws:lambda:us-east-2:1234:layer:something-else:2"],
            },
        }

        mock_client = mock_gen_aws_client.return_value
        mock_client.get_function = MagicMock(return_value=expected_get_function_return)

        class AwsLambdaProxyApiTestClient(AwsLambdaProxyClient):
            _use_proxy_url_for_tests = True

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = AwsLambdaProxyApiTestClient(
                org_integration_id=self.installation.org_integration.id,
                account_number=self.account_number,
                region=self.region,
                aws_external_id=self.aws_external_id,
            )
            actual = client.get_function(FunctionName="lambdaE")
            assert mock_client.get_function.call_count == 1
            assert actual == expected_get_function_return
            assert len(responses.calls) == 0

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            mock_client.get_function.reset_mock()
            assert mock_client.get_function.call_count == 0

            client = AwsLambdaProxyApiTestClient(
                org_integration_id=self.installation.org_integration.id,
                account_number=self.account_number,
                region=self.region,
                aws_external_id=self.aws_external_id,
            )
            actual = client.get_function(FunctionName="lambdaE")
            assert mock_client.get_function.call_count == 1
            assert actual == expected_get_function_return
            assert len(responses.calls) == 0

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.REGION):
            responses.add(
                responses.POST,
                "http://controlserver/api/0/internal/integration-proxy/",
                match=[
                    matchers.header_matcher(
                        {
                            "Content-Type": "application/json",
                            "X-Sentry-Subnet-Organization-Integration": str(
                                self.installation.org_integration.id
                            ),
                        },
                    ),
                    matchers.json_params_matcher(
                        {
                            "args": [],
                            "function_name": "get_function",
                            "kwargs": {"FunctionName": "lambdaE"},
                        }
                    ),
                ],
                json={
                    "function_name": "get_function",
                    "return_response": expected_get_function_return,
                    "exception": None,
                },
            )
            mock_client.get_function.reset_mock()
            assert mock_client.get_function.call_count == 0

            client = AwsLambdaProxyApiTestClient(
                org_integration_id=self.installation.org_integration.id,
                account_number=self.account_number,
                region=self.region,
                aws_external_id=self.aws_external_id,
            )
            actual = client.get_function(FunctionName="lambdaE")
            assert mock_client.get_function.call_count == 0
            assert actual == expected_get_function_return
            assert len(responses.calls) == 1
            request = responses.calls[0].request
            assert "http://controlserver/api/0/internal/integration-proxy/" == request.url
            assert client.base_url and (client.base_url.lower() in request.url)
            assert_proxy_request(request, is_proxy=True)

    @patch("sentry.integrations.aws_lambda.client.gen_aws_client")
    @responses.activate
    def test_delegates_exception(self, mock_gen_aws_client):
        class AWSOrganizationsNotInUseException(Exception):
            pass

        mock_client = mock_gen_aws_client.return_value
        mock_client.get_function = MagicMock(side_effect=AWSOrganizationsNotInUseException())

        class AwsLambdaProxyApiTestClient(AwsLambdaProxyClient):
            _use_proxy_url_for_tests = True

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            mock_client.get_function.reset_mock()
            assert mock_client.get_function.call_count == 0

            client = AwsLambdaProxyApiTestClient(
                org_integration_id=self.installation.org_integration.id,
                account_number=self.account_number,
                region=self.region,
                aws_external_id=self.aws_external_id,
            )
            assert client.should_delegate()
            with pytest.raises(AWSOrganizationsNotInUseException):
                client.get_function(FunctionName="lambdaE")
                assert mock_client.get_function.call_count == 1
                assert len(responses.calls) == 0

            expected_proxy_payload = {
                "args": ["hello"],
                "kwargs": {"function_name": "lambdaE"},
                "function_name": "get_function",
            }
            signature = encode_subnet_signature(
                secret=SENTRY_SUBNET_SECRET,
                base_url=get_proxy_url(),
                path="",
                identifier=str(self.installation.org_integration.id),
                request_body=json.dumps(expected_proxy_payload).encode("utf-8"),
            )
            headers = SiloHttpHeaders(
                HTTP_X_SENTRY_SUBNET_SIGNATURE=signature,
                HTTP_X_SENTRY_SUBNET_ORGANIZATION_INTEGRATION=str(
                    self.installation.org_integration.id
                ),
            )
            request = APIRequestFactory().post(
                f"{PROXY_BASE_PATH}/", **headers, data=expected_proxy_payload, format="json"
            )

            @api_view(["GET", "POST"])
            def view(request):
                return request

            response = view(request)
            response.render()
            request = response.renderer_context["request"]
            proxy_response = client.delegate(request=request, proxy_path="", headers=headers)

            actual_response_payload = json.loads(proxy_response.content)
            assert actual_response_payload == {
                "function_name": "get_function",
                "return_response": {},
                "exception": {"class": "AWSOrganizationsNotInUseException"},
            }

    @patch("sentry.integrations.aws_lambda.client.gen_aws_client")
    @responses.activate
    def test_wrapped_boto3_client_raises_exception(self, mock_gen_aws_client):
        class AWSOrganizationsNotInUseException(Exception):
            pass

        mock_client = mock_gen_aws_client.return_value
        mock_client.get_function = MagicMock()
        mock_client.exceptions.AWSOrganizationsNotInUseException = AWSOrganizationsNotInUseException

        class AwsLambdaProxyApiTestClient(AwsLambdaProxyClient):
            _use_proxy_url_for_tests = True

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.REGION):

            responses.add(
                responses.POST,
                "http://controlserver/api/0/internal/integration-proxy/",
                match=[
                    matchers.header_matcher(
                        {
                            "Content-Type": "application/json",
                            "X-Sentry-Subnet-Organization-Integration": str(
                                self.installation.org_integration.id
                            ),
                        },
                    ),
                    matchers.json_params_matcher(
                        {
                            "args": [],
                            "function_name": "get_function",
                            "kwargs": {"FunctionName": "lambdaE"},
                        }
                    ),
                ],
                json={
                    "function_name": "get_function",
                    "return_response": {},
                    "exception": {"class": "AWSOrganizationsNotInUseException"},
                },
            )

            client = AwsLambdaProxyApiTestClient(
                org_integration_id=self.installation.org_integration.id,
                account_number=self.account_number,
                region=self.region,
                aws_external_id=self.aws_external_id,
            )
            assert client.should_delegate()
            with pytest.raises(client.client.exceptions.AWSOrganizationsNotInUseException):
                client.get_function(FunctionName="lambdaE")
            assert mock_client.get_function.call_count == 0
