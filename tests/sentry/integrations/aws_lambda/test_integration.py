from typing import Any
from unittest.mock import ANY, MagicMock, patch
from urllib.parse import urlencode

from botocore.exceptions import ClientError
from django.http import HttpResponse
from django.urls import reverse

from sentry.integrations.aws_lambda import AwsLambdaIntegrationProvider
from sentry.integrations.aws_lambda import integration as aws_lambda_integration
from sentry.integrations.aws_lambda.utils import ALL_AWS_REGIONS
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.models.projectkey import ProjectKey
from sentry.organizations.services.organization import organization_service
from sentry.projects.services.project import project_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, IntegrationTestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.services.user.serial import serialize_rpc_user

arn = (
    "arn:aws:cloudformation:us-east-2:599817902985:stack/"
    "Sentry-Monitoring-Stack/e42083d0-3e3f-11eb-b66a-0ac9b5db7f30"
)

account_number = "599817902985"
region = "us-east-2"
aws_external_id = "test-external-id-1234"


@control_silo_test
class AwsLambdaIntegrationTest(IntegrationTestCase):
    provider = AwsLambdaIntegrationProvider

    def setUp(self) -> None:
        super().setUp()
        self.projectA = self.create_project(organization=self.organization, slug="projA")
        self.projectB = self.create_project(organization=self.organization, slug="projB")

    @patch.object(aws_lambda_integration, "render_react_view", return_value=HttpResponse())
    def test_project_select(self, mock_react_view: MagicMock) -> None:
        resp = self.client.get(self.setup_path)
        assert resp.status_code == 200
        serialized_projects = project_service.serialize_many(
            organization_id=self.projectA.organization_id,
            filter=dict(project_ids=[self.projectA.id, self.projectB.id]),
        )
        mock_react_view.assert_called_with(
            ANY, "awsLambdaProjectSelect", {"projects": serialized_projects}
        )

    @patch.object(aws_lambda_integration, "render_react_view", return_value=HttpResponse())
    def test_one_project(self, mock_react_view: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.MONOLITH):
            self.projectB.delete()
        resp = self.client.get(self.setup_path)
        assert resp.status_code == 200
        mock_react_view.assert_called_with(ANY, "awsLambdaCloudformation", ANY)

    @patch.object(aws_lambda_integration, "render_react_view", return_value=HttpResponse())
    def test_render_cloudformation_view(self, mock_react_view: MagicMock) -> None:
        self.pipeline.state.step_index = 1
        resp = self.client.get(self.setup_path)
        assert resp.status_code == 200
        mock_react_view.assert_called_with(
            ANY,
            "awsLambdaCloudformation",
            {
                "baseCloudformationUrl": "https://console.aws.amazon.com/cloudformation/home#/stacks/create/review",
                "templateUrl": "https://example.com/file.json",
                "stackName": "Sentry-Monitoring-Stack",
                "regionList": ALL_AWS_REGIONS,
                "region": None,
                "accountNumber": None,
                "error": None,
                "initialStepNumber": 1,
                "organization": organization_service.serialize_organization(
                    id=self.organization.id, as_user=serialize_rpc_user(self.user)
                ),
                "awsExternalId": None,
            },
        )

    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    @patch.object(aws_lambda_integration, "render_react_view", return_value=HttpResponse())
    def test_set_valid_arn(
        self, mock_react_view: MagicMock, mock_gen_aws_client: MagicMock
    ) -> None:
        self.pipeline.state.step_index = 1
        data = {"region": region, "accountNumber": account_number, "awsExternalId": "my-id"}
        resp = self.client.get(self.setup_path + "?" + urlencode(data))
        assert resp.status_code == 200
        mock_react_view.assert_called_with(ANY, "awsLambdaFunctionSelect", ANY)

    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    @patch.object(aws_lambda_integration, "render_react_view", return_value=HttpResponse())
    def test_set_arn_with_error(
        self, mock_react_view: MagicMock, mock_gen_aws_client: MagicMock
    ) -> None:
        self.pipeline.state.step_index = 1
        mock_gen_aws_client.side_effect = ClientError({"Error": {}}, "assume_role")
        data = {"region": region, "accountNumber": account_number, "awsExternalId": "my-id"}
        resp = self.client.get(self.setup_path + "?" + urlencode(data))
        assert resp.status_code == 200
        mock_react_view.assert_called_with(
            ANY,
            "awsLambdaCloudformation",
            # Ensure that the expected value passes through json serialization
            {
                "baseCloudformationUrl": "https://console.aws.amazon.com/cloudformation/home#/stacks/create/review",
                "templateUrl": "https://example.com/file.json",
                "stackName": "Sentry-Monitoring-Stack",
                "regionList": ALL_AWS_REGIONS,
                "region": region,
                "accountNumber": account_number,
                "error": "Please validate the Cloudformation stack was created successfully",
                "initialStepNumber": 1,
                "organization": organization_service.serialize_organization(
                    id=self.organization.id, as_user=serialize_rpc_user(self.user)
                ),
                "awsExternalId": "my-id",
            },
        )

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    @patch.object(aws_lambda_integration, "render_react_view", return_value=HttpResponse())
    def test_lambda_list(
        self,
        mock_react_view: MagicMock,
        mock_gen_aws_client: MagicMock,
        mock_get_supported_functions: MagicMock,
    ) -> None:
        mock_get_supported_functions.return_value = [
            {"FunctionName": "lambdaA", "Runtime": "nodejs12.x"},
            {"FunctionName": "lambdaB", "Runtime": "nodejs10.x"},
            {"FunctionName": "lambdaC", "Runtime": "python3.6"},
            {"FunctionName": "lambdaD", "Runtime": "python3.7"},
            {"FunctionName": "lambdaE", "Runtime": "python3.8"},
            {"FunctionName": "lambdaD", "Runtime": "python3.9"},
        ]

        aws_external_id = "12-323"
        self.pipeline.state.step_index = 2
        self.pipeline.state.data = {
            "region": region,
            "accountNumber": account_number,
            "aws_external_id": aws_external_id,
            "project_id": self.projectA.id,
        }
        resp = self.client.get(self.setup_path)
        assert resp.status_code == 200
        mock_react_view.assert_called_with(
            ANY,
            "awsLambdaFunctionSelect",
            {
                "lambdaFunctions": [
                    {"FunctionName": "lambdaA", "Runtime": "nodejs12.x"},
                    {"FunctionName": "lambdaB", "Runtime": "nodejs10.x"},
                    {"FunctionName": "lambdaC", "Runtime": "python3.6"},
                    {"FunctionName": "lambdaD", "Runtime": "python3.7"},
                    {"FunctionName": "lambdaE", "Runtime": "python3.8"},
                    {"FunctionName": "lambdaD", "Runtime": "python3.9"},
                ],
                "initialStepNumber": 3,
            },
        )

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_node_lambda_setup_layer_success(
        self,
        mock_gen_aws_client,
        mock_get_supported_functions,
    ):
        for layer_name, layer_version, expected_node_options in [
            ("SentryNodeServerlessSDKv7", "5", "-r @sentry/serverless/dist/awslambda-auto"),
            ("SentryNodeServerlessSDK", "168", "-r @sentry/serverless/dist/awslambda-auto"),
            ("SentryNodeServerlessSDK", "235", "-r @sentry/serverless/dist/awslambda-auto"),
            ("SentryNodeServerlessSDK", "236", "-r @sentry/aws-serverless/awslambda-auto"),
            ("SentryNodeServerlessSDKv8", "3", "-r @sentry/aws-serverless/awslambda-auto"),
            ("SentryNodeServerlessSDKv9", "235", "-r @sentry/aws-serverless/awslambda-auto"),
        ]:
            with override_options(
                {
                    "aws-lambda.node.layer-name": layer_name,
                    "aws-lambda.node.layer-version": layer_version,
                }
            ):
                # Ensure we reset everything
                self.setUp()
                mock_get_supported_functions.reset_mock()
                mock_gen_aws_client.reset_mock()

                mock_client = mock_gen_aws_client.return_value
                mock_client.update_function_configuration = MagicMock()
                mock_client.describe_account = MagicMock(
                    return_value={"Account": {"Name": "my_name"}}
                )

                mock_get_supported_functions.return_value = [
                    {
                        "FunctionName": "lambdaA",
                        "Runtime": "nodejs12.x",
                        "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaA",
                    },
                    {
                        "FunctionName": "lambdaB",
                        "Runtime": "nodejs10.x",
                        "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaB",
                    },
                ]

                aws_external_id = "12-323"
                self.pipeline.state.step_index = 2
                self.pipeline.state.data = {
                    "region": region,
                    "account_number": account_number,
                    "aws_external_id": aws_external_id,
                    "project_id": self.projectA.id,
                }

                with assume_test_silo_mode(SiloMode.CELL):
                    sentry_project_dsn = ProjectKey.get_default(project=self.projectA).get_dsn(
                        public=True
                    )

                # TODO: pass in lambdaA=false
                # having issues with reading json data
                # request.POST looks like {"lambdaB": "True"}
                # string instead of boolean
                resp = self.client.post(self.setup_path, {"lambdaB": "true", "lambdaA": "false"})

                assert resp.status_code == 200

                mock_client.update_function_configuration.assert_called_once_with(
                    FunctionName="lambdaB",
                    Layers=[f"arn:aws:lambda:us-east-2:1234:layer:{layer_name}:{layer_version}"],
                    Environment={
                        "Variables": {
                            "NODE_OPTIONS": expected_node_options,
                            "SENTRY_DSN": sentry_project_dsn,
                            "SENTRY_TRACES_SAMPLE_RATE": "1.0",
                        }
                    },
                )

                integration = Integration.objects.get(provider=self.provider.key)
                assert integration.name == "my_name us-east-2"
                assert integration.external_id == "599817902985-us-east-2"
                assert integration.metadata == {
                    "region": region,
                    "account_number": account_number,
                    "aws_external_id": aws_external_id,
                }
                assert OrganizationIntegration.objects.filter(
                    integration=integration, organization_id=self.organization.id
                )

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_python_lambda_setup_layer_success(
        self, mock_gen_aws_client, mock_get_supported_functions
    ):
        mock_client = mock_gen_aws_client.return_value
        mock_client.update_function_configuration = MagicMock()
        mock_client.describe_account = MagicMock(return_value={"Account": {"Name": "my_name"}})

        mock_get_supported_functions.return_value = [
            {
                "FunctionName": "lambdaA",
                "Handler": "lambda_handler.test_handler",
                "Runtime": "python3.6",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaA",
            }
        ]

        aws_external_id = "12-323"
        self.pipeline.state.step_index = 2
        self.pipeline.state.data = {
            "region": region,
            "account_number": account_number,
            "aws_external_id": aws_external_id,
            "project_id": self.projectA.id,
        }

        with assume_test_silo_mode(SiloMode.CELL):
            sentry_project_dsn = ProjectKey.get_default(project=self.projectA).get_dsn(public=True)

        resp = self.client.post(self.setup_path, {"lambdaA": "true"})

        assert resp.status_code == 200

        mock_client.update_function_configuration.assert_called_once_with(
            FunctionName="lambdaA",
            Layers=["arn:aws:lambda:us-east-2:1234:layer:my-python-layer:34"],
            Environment={
                "Variables": {
                    "SENTRY_INITIAL_HANDLER": "lambda_handler.test_handler",
                    "SENTRY_DSN": sentry_project_dsn,
                    "SENTRY_TRACES_SAMPLE_RATE": "1.0",
                }
            },
            Handler="sentry_sdk.integrations.init_serverless_sdk.sentry_lambda_handler",
        )

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.name == "my_name us-east-2"
        assert integration.external_id == "599817902985-us-east-2"
        assert integration.metadata == {
            "region": region,
            "account_number": account_number,
            "aws_external_id": aws_external_id,
        }
        assert OrganizationIntegration.objects.filter(
            integration=integration, organization_id=self.organization.id
        )

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    @patch.object(aws_lambda_integration, "render_react_view", return_value=HttpResponse())
    def test_lambda_setup_layer_error(
        self, mock_react_view, mock_gen_aws_client, mock_get_supported_functions
    ):
        class MockException(Exception):
            pass

        bad_layer = "arn:aws:lambda:us-east-2:546545:layer:another-layer:5"
        mock_client = mock_gen_aws_client.return_value
        mock_client.update_function_configuration = MagicMock(
            side_effect=Exception(f"Layer version {bad_layer} does not exist")
        )
        mock_client.describe_account = MagicMock(return_value={"Account": {"Name": "my_name"}})
        mock_client.exceptions = MagicMock()
        mock_client.exceptions.ResourceConflictException = MockException

        mock_get_supported_functions.return_value = [
            {
                "FunctionName": "lambdaA",
                "Runtime": "nodejs12.x",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaA",
            },
            {
                "FunctionName": "lambdaB",
                "Runtime": "nodejs10.x",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaB",
            },
        ]

        aws_external_id = "12-323"
        self.pipeline.state.step_index = 2
        self.pipeline.state.data = {
            "region": region,
            "account_number": account_number,
            "aws_external_id": aws_external_id,
            "project_id": self.projectA.id,
        }

        resp = self.client.post(self.setup_path, {"lambdaB": "true"})

        assert resp.status_code == 200
        assert not Integration.objects.filter(provider=self.provider.key).exists()

        failures = [{"name": "lambdaB", "error": "Invalid existing layer another-layer"}]

        mock_react_view.assert_called_with(
            ANY, "awsLambdaFailureDetails", {"lambdaFunctionFailures": failures, "successCount": 0}
        )

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    @patch.object(aws_lambda_integration, "render_react_view", return_value=HttpResponse())
    def test_lambda_setup_layer_missing_role_error(
        self, mock_react_view, mock_gen_aws_client, mock_get_supported_functions
    ):
        class MockException(Exception):
            pass

        missing_role_err = (
            "An error occurred (InvalidParameterValueException) when "
            "calling the UpdateFunctionConfiguration operation: "
            "The role defined for the function cannot be "
            "assumed by Lambda."
        )
        mock_client = mock_gen_aws_client.return_value
        mock_client.update_function_configuration = MagicMock(
            side_effect=Exception(missing_role_err)
        )
        mock_client.describe_account = MagicMock(return_value={"Account": {"Name": "my_name"}})
        mock_client.exceptions = MagicMock()
        mock_client.exceptions.ResourceConflictException = MockException

        mock_get_supported_functions.return_value = [
            {
                "FunctionName": "lambdaB",
                "Runtime": "nodejs10.x",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaB",
            },
        ]

        aws_external_id = "12-323"
        self.pipeline.state.step_index = 2
        self.pipeline.state.data = {
            "region": region,
            "account_number": account_number,
            "aws_external_id": aws_external_id,
            "project_id": self.projectA.id,
        }

        resp = self.client.post(self.setup_path, {"lambdaB": "true"})

        assert resp.status_code == 200
        assert not Integration.objects.filter(provider=self.provider.key).exists()

        failures = [
            {"name": "lambdaB", "error": "Invalid role associated with the lambda function"}
        ]

        mock_react_view.assert_called_with(
            ANY, "awsLambdaFailureDetails", {"lambdaFunctionFailures": failures, "successCount": 0}
        )

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    @patch.object(aws_lambda_integration, "render_react_view", return_value=HttpResponse())
    def test_lambda_setup_layer_too_many_requests_exception(
        self, mock_react_view, mock_gen_aws_client, mock_get_supported_functions
    ):
        class MockException(Exception):
            pass

        too_many_requests_err = (
            "An error occurred (TooManyRequestsException) when calling the "
            "UpdateFunctionConfiguration operation (reached max retries: 4): "
            "Rate exceeded"
        )
        mock_client = mock_gen_aws_client.return_value
        mock_client.update_function_configuration = MagicMock(
            side_effect=Exception(too_many_requests_err)
        )
        mock_client.describe_account = MagicMock(return_value={"Account": {"Name": "my_name"}})
        mock_client.exceptions = MagicMock()
        mock_client.exceptions.ResourceConflictException = MockException

        mock_get_supported_functions.return_value = [
            {
                "FunctionName": "lambdaB",
                "Runtime": "nodejs10.x",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaB",
            },
        ]

        aws_external_id = "12-323"
        self.pipeline.state.step_index = 2
        self.pipeline.state.data = {
            "region": region,
            "account_number": account_number,
            "aws_external_id": aws_external_id,
            "project_id": self.projectA.id,
        }

        resp = self.client.post(self.setup_path, {"lambdaB": "true"})

        assert resp.status_code == 200
        assert not Integration.objects.filter(provider=self.provider.key).exists()

        failures = [
            {
                "name": "lambdaB",
                "error": "Something went wrong! Please enable function manually after installation",
            }
        ]

        mock_react_view.assert_called_with(
            ANY, "awsLambdaFailureDetails", {"lambdaFunctionFailures": failures, "successCount": 0}
        )

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    @patch.object(aws_lambda_integration, "render_react_view", return_value=HttpResponse())
    def test_lambda_setup_layer_env_vars_limit_exceeded_exception(
        self, mock_react_view, mock_gen_aws_client, mock_get_supported_functions
    ):
        class MockException(Exception):
            pass

        env_vars_size_limit_err = (
            "An error occurred (InvalidParameterValueException) when calling the "
            "UpdateFunctionConfiguration operation: Lambda was unable to configure "
            "your environment variables because the environment variables you have "
            "provided exceeded the 4KB limit. String measured: {'MESSAGE':'This is production "
            "environment','TARGET_ENV' :'pre-production','IS_SERVERLESS':'true','STAGE':'pre-prod'"
        )
        mock_client = mock_gen_aws_client.return_value
        mock_client.update_function_configuration = MagicMock(
            side_effect=Exception(env_vars_size_limit_err)
        )
        mock_client.describe_account = MagicMock(return_value={"Account": {"Name": "my_name"}})
        mock_client.exceptions = MagicMock()
        mock_client.exceptions.ResourceConflictException = MockException

        mock_get_supported_functions.return_value = [
            {
                "FunctionName": "lambdaB",
                "Runtime": "nodejs10.x",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaB",
            },
        ]

        aws_external_id = "12-323"
        self.pipeline.state.step_index = 2
        self.pipeline.state.data = {
            "region": region,
            "account_number": account_number,
            "aws_external_id": aws_external_id,
            "project_id": self.projectA.id,
        }

        resp = self.client.post(self.setup_path, {"lambdaB": "true"})

        assert resp.status_code == 200
        assert not Integration.objects.filter(provider=self.provider.key).exists()

        failures = [
            {
                "name": "lambdaB",
                "error": "Environment variables size limit of 4KB was exceeded",
            }
        ]

        mock_react_view.assert_called_with(
            ANY, "awsLambdaFailureDetails", {"lambdaFunctionFailures": failures, "successCount": 0}
        )


@control_silo_test
class AwsLambdaApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.projectA = self.create_project(organization=self.organization, slug="projA")
        self.projectB = self.create_project(organization=self.organization, slug="projB")

    def _get_pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _initialize_pipeline(self) -> Any:
        return self.client.post(
            self._get_pipeline_url(),
            data={"action": "initialize", "provider": "aws_lambda"},
            format="json",
        )

    def _advance_step(self, data: dict[str, Any]) -> Any:
        return self.client.post(self._get_pipeline_url(), data=data, format="json")

    def _get_step_info(self) -> Any:
        return self.client.get(self._get_pipeline_url())

    def test_initialize_pipeline(self) -> None:
        resp = self._initialize_pipeline()
        assert resp.status_code == 200
        assert resp.data["step"] == "project_select"
        assert resp.data["stepIndex"] == 0
        assert resp.data["totalSteps"] == 3
        assert resp.data["provider"] == "aws_lambda"

    def test_project_select_step_data(self) -> None:
        self._initialize_pipeline()
        resp = self._get_step_info()
        assert resp.status_code == 200
        assert resp.data["step"] == "project_select"
        assert resp.data["data"] == {}

    def test_project_select_advance(self) -> None:
        self._initialize_pipeline()
        resp = self._advance_step({"projectId": self.projectA.id})
        assert resp.status_code == 200
        assert resp.data["status"] == "advance"
        assert resp.data["step"] == "cloudformation"

    def test_project_select_invalid_project(self) -> None:
        self._initialize_pipeline()
        resp = self._advance_step({"projectId": 99999})
        assert resp.status_code == 400
        assert resp.data["status"] == "error"

    def test_project_select_missing_project_id(self) -> None:
        self._initialize_pipeline()
        resp = self._advance_step({})
        assert resp.status_code == 400

    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_cloudformation_step_data(self, mock_gen_aws_client: MagicMock) -> None:
        self._initialize_pipeline()
        self._advance_step({"projectId": self.projectA.id})
        resp = self._get_step_info()
        assert resp.status_code == 200
        assert resp.data["step"] == "cloudformation"
        data = resp.data["data"]
        assert "templateUrl" in data
        assert "regionList" in data
        assert data["stackName"] == "Sentry-Monitoring-Stack"

    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_cloudformation_advance(self, mock_gen_aws_client: MagicMock) -> None:
        self._initialize_pipeline()
        self._advance_step({"projectId": self.projectA.id})
        resp = self._advance_step(
            {
                "accountNumber": account_number,
                "region": region,
                "awsExternalId": aws_external_id,
            }
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "advance"
        assert resp.data["step"] == "instrumentation"

    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_cloudformation_invalid_region(self, mock_gen_aws_client: MagicMock) -> None:
        self._initialize_pipeline()
        self._advance_step({"projectId": self.projectA.id})
        resp = self._advance_step(
            {
                "accountNumber": account_number,
                "region": "invalid-region",
                "awsExternalId": aws_external_id,
            }
        )
        assert resp.status_code == 400
        assert "region" in resp.data

    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_cloudformation_invalid_account_number(self, mock_gen_aws_client: MagicMock) -> None:
        self._initialize_pipeline()
        self._advance_step({"projectId": self.projectA.id})
        resp = self._advance_step(
            {
                "accountNumber": "bad",
                "region": region,
                "awsExternalId": aws_external_id,
            }
        )
        assert resp.status_code == 400
        assert "accountNumber" in resp.data

    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_cloudformation_client_error(self, mock_gen_aws_client: MagicMock) -> None:
        mock_gen_aws_client.side_effect = ClientError({"Error": {}}, "assume_role")
        self._initialize_pipeline()
        self._advance_step({"projectId": self.projectA.id})
        resp = self._advance_step(
            {
                "accountNumber": account_number,
                "region": region,
                "awsExternalId": aws_external_id,
            }
        )
        assert resp.status_code == 400
        assert resp.data["status"] == "error"
        assert "Cloudformation" in resp.data["data"]["detail"]

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_instrumentation_step_data(
        self,
        mock_gen_aws_client: MagicMock,
        mock_get_supported_functions: MagicMock,
    ) -> None:
        mock_get_supported_functions.return_value = [
            {"FunctionName": "lambdaB", "Runtime": "nodejs12.x", "Description": "B func"},
            {"FunctionName": "lambdaA", "Runtime": "python3.9", "Description": "A func"},
        ]

        self._initialize_pipeline()
        self._advance_step({"projectId": self.projectA.id})
        self._advance_step(
            {
                "accountNumber": account_number,
                "region": region,
                "awsExternalId": aws_external_id,
            }
        )
        resp = self._get_step_info()
        assert resp.status_code == 200
        assert resp.data["step"] == "instrumentation"
        functions = resp.data["data"]["functions"]
        assert len(functions) == 2
        assert functions[0]["name"] == "lambdaA"
        assert functions[1]["name"] == "lambdaB"

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_full_api_pipeline_success(
        self,
        mock_gen_aws_client: MagicMock,
        mock_get_supported_functions: MagicMock,
    ) -> None:
        mock_client = mock_gen_aws_client.return_value
        mock_client.update_function_configuration = MagicMock()
        mock_client.describe_account = MagicMock(return_value={"Account": {"Name": "my_name"}})

        mock_get_supported_functions.return_value = [
            {
                "FunctionName": "lambdaA",
                "Runtime": "nodejs12.x",
                "FunctionArn": f"arn:aws:lambda:{region}:{account_number}:function:lambdaA",
            },
        ]

        with assume_test_silo_mode(SiloMode.CELL):
            sentry_project_dsn = ProjectKey.get_default(project=self.projectA).get_dsn(public=True)

        self._initialize_pipeline()
        self._advance_step({"projectId": self.projectA.id})
        self._advance_step(
            {
                "accountNumber": account_number,
                "region": region,
                "awsExternalId": aws_external_id,
            }
        )
        resp = self._advance_step({"enabledFunctions": ["lambdaA"]})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        mock_client.update_function_configuration.assert_called_once()
        call_kwargs = mock_client.update_function_configuration.call_args[1]
        assert call_kwargs["FunctionName"] == "lambdaA"
        assert call_kwargs["Environment"]["Variables"]["SENTRY_DSN"] == sentry_project_dsn

        integration = Integration.objects.get(provider="aws_lambda")
        assert integration.name == f"my_name {region}"
        assert integration.external_id == f"{account_number}-{region}"
        assert integration.metadata["account_number"] == account_number
        assert integration.metadata["region"] == region
        assert "aws_external_id" in integration.metadata
        assert OrganizationIntegration.objects.filter(
            integration=integration, organization_id=self.organization.id
        ).exists()

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_instrumentation_with_failures(
        self,
        mock_gen_aws_client: MagicMock,
        mock_get_supported_functions: MagicMock,
    ) -> None:
        class MockException(Exception):
            pass

        bad_layer = "arn:aws:lambda:us-east-2:546545:layer:another-layer:5"
        mock_client = mock_gen_aws_client.return_value
        mock_client.update_function_configuration = MagicMock(
            side_effect=Exception(f"Layer version {bad_layer} does not exist")
        )
        mock_client.describe_account = MagicMock(return_value={"Account": {"Name": "my_name"}})
        mock_client.exceptions = MagicMock()
        mock_client.exceptions.ResourceConflictException = MockException

        mock_get_supported_functions.return_value = [
            {
                "FunctionName": "lambdaA",
                "Runtime": "nodejs12.x",
                "FunctionArn": f"arn:aws:lambda:{region}:{account_number}:function:lambdaA",
            },
        ]

        self._initialize_pipeline()
        self._advance_step({"projectId": self.projectA.id})
        self._advance_step(
            {
                "accountNumber": account_number,
                "region": region,
                "awsExternalId": aws_external_id,
            }
        )

        resp = self._advance_step({"enabledFunctions": ["lambdaA"]})
        assert resp.status_code == 200
        assert resp.data["status"] == "stay"
        assert resp.data["data"]["successCount"] == 0
        assert len(resp.data["data"]["failures"]) == 1
        assert resp.data["data"]["failures"][0]["name"] == "lambdaA"
        assert "another-layer" in resp.data["data"]["failures"][0]["error"]

        # User retries (or deselects failed functions), pipeline finishes
        mock_client.update_function_configuration = MagicMock()
        resp = self._advance_step({"enabledFunctions": ["lambdaA"]})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        integration = Integration.objects.get(provider="aws_lambda")
        assert integration.external_id == f"{account_number}-{region}"

        integration = Integration.objects.get(provider="aws_lambda")
        assert integration.external_id == f"{account_number}-{region}"
