from unittest.mock import ANY, MagicMock, patch
from urllib.parse import urlencode

from botocore.exceptions import ClientError
from django.http import HttpResponse

from sentry.api.serializers import serialize
from sentry.integrations.aws_lambda import AwsLambdaIntegrationProvider
from sentry.integrations.aws_lambda.utils import ALL_AWS_REGIONS
from sentry.models import Integration, OrganizationIntegration, ProjectKey
from sentry.pipeline import PipelineView
from sentry.testutils import IntegrationTestCase
from sentry.testutils.helpers.faux import Mock

arn = (
    "arn:aws:cloudformation:us-east-2:599817902985:stack/"
    "Sentry-Monitoring-Stack/e42083d0-3e3f-11eb-b66a-0ac9b5db7f30"
)

account_number = "599817902985"
region = "us-east-2"


class AwsLambdaIntegrationTest(IntegrationTestCase):
    provider = AwsLambdaIntegrationProvider

    def setUp(self):
        super().setUp()
        self.projectA = self.create_project(organization=self.organization, slug="projA")
        self.projectB = self.create_project(organization=self.organization, slug="projB")

    @patch.object(PipelineView, "render_react_view", return_value=HttpResponse())
    def test_project_select(self, mock_react_view):
        resp = self.client.get(self.setup_path)
        assert resp.status_code == 200
        serialized_projects = list(
            map(lambda x: serialize(x, self.user), [self.projectA, self.projectB])
        )
        mock_react_view.assert_called_with(
            ANY, "awsLambdaProjectSelect", {"projects": serialized_projects}
        )

    @patch.object(PipelineView, "render_react_view", return_value=HttpResponse())
    def test_one_project(self, mock_react_view):
        self.projectB.delete()
        resp = self.client.get(self.setup_path)
        assert resp.status_code == 200
        mock_react_view.assert_called_with(ANY, "awsLambdaCloudformation", ANY)

    @patch.object(PipelineView, "render_react_view", return_value=HttpResponse())
    def test_render_cloudformation_view(self, mock_react_view):
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
                "organization": serialize(self.organization),
                "awsExternalId": None,
            },
        )

    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    @patch.object(PipelineView, "render_react_view", return_value=HttpResponse())
    def test_set_valid_arn(self, mock_react_view, mock_gen_aws_client):
        self.pipeline.state.step_index = 1
        data = {"region": region, "accountNumber": account_number, "awsExternalId": "my-id"}
        resp = self.client.get(self.setup_path + "?" + urlencode(data))
        assert resp.status_code == 200
        mock_react_view.assert_called_with(ANY, "awsLambdaFunctionSelect", ANY)

    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    @patch.object(PipelineView, "render_react_view", return_value=HttpResponse())
    def test_set_arn_with_error(self, mock_react_view, mock_gen_aws_client):
        self.pipeline.state.step_index = 1
        mock_gen_aws_client.side_effect = ClientError({"Error": {}}, "assume_role")
        data = {"region": region, "accountNumber": account_number, "awsExternalId": "my-id"}
        resp = self.client.get(self.setup_path + "?" + urlencode(data))
        assert resp.status_code == 200
        mock_react_view.assert_called_with(
            ANY,
            "awsLambdaCloudformation",
            {
                "baseCloudformationUrl": "https://console.aws.amazon.com/cloudformation/home#/stacks/create/review",
                "templateUrl": "https://example.com/file.json",
                "stackName": "Sentry-Monitoring-Stack",
                "regionList": ALL_AWS_REGIONS,
                "region": region,
                "accountNumber": account_number,
                "error": "Please validate the Cloudformation stack was created successfully",
                "initialStepNumber": 1,
                "organization": serialize(self.organization),
                "awsExternalId": "my-id",
            },
        )

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    @patch.object(PipelineView, "render_react_view", return_value=HttpResponse())
    def test_lambda_list(self, mock_react_view, mock_gen_aws_client, mock_get_supported_functions):
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
    def test_lambda_setup_layer_success(self, mock_gen_aws_client, mock_get_supported_functions):
        mock_client = Mock()
        mock_gen_aws_client.return_value = mock_client
        mock_client.update_function_configuration = MagicMock()
        mock_client.describe_account = MagicMock(return_value={"Account": {"Name": "my_name"}})

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

        sentry_project_dsn = ProjectKey.get_default(project=self.projectA).get_dsn(public=True)

        # TODO: pass in lambdaA=false
        # having issues with reading json data
        # request.POST looks like {"lambdaB": "True"}
        # string instead of boolean
        resp = self.client.post(
            self.setup_path,
            data={"lambdaB": True},
            format="json",
            HTTP_ACCEPT="application/json",
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )

        assert resp.status_code == 200

        mock_client.update_function_configuration.assert_called_once_with(
            FunctionName="lambdaB",
            Layers=["arn:aws:lambda:us-east-2:1234:layer:my-layer:3"],
            Environment={
                "Variables": {
                    "NODE_OPTIONS": "-r @sentry/serverless/dist/awslambda-auto",
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
            integration=integration, organization=self.organization
        )

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_python_lambda_setup_layer_success(
        self, mock_gen_aws_client, mock_get_supported_functions
    ):
        mock_client = Mock()
        mock_gen_aws_client.return_value = mock_client
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

        sentry_project_dsn = ProjectKey.get_default(project=self.projectA).get_dsn(public=True)

        resp = self.client.post(
            self.setup_path,
            data={"lambdaA": True},
            format="json",
            HTTP_ACCEPT="application/json",
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )

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
            integration=integration, organization=self.organization
        )

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    @patch.object(PipelineView, "render_react_view", return_value=HttpResponse())
    def test_lambda_setup_layer_error(
        self, mock_react_view, mock_gen_aws_client, mock_get_supported_functions
    ):
        class MockException(Exception):
            pass

        bad_layer = "arn:aws:lambda:us-east-2:546545:layer:another-layer:5"
        mock_client = Mock()
        mock_gen_aws_client.return_value = mock_client
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

        resp = self.client.post(
            self.setup_path,
            {"lambdaB": True},
            format="json",
            HTTP_ACCEPT="application/json",
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )

        assert resp.status_code == 200
        assert not Integration.objects.filter(provider=self.provider.key).exists()

        failures = [{"name": "lambdaB", "error": "Invalid existing layer another-layer"}]

        mock_react_view.assert_called_with(
            ANY, "awsLambdaFailureDetails", {"lambdaFunctionFailures": failures, "successCount": 0}
        )

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    @patch.object(PipelineView, "render_react_view", return_value=HttpResponse())
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
        mock_client = Mock()
        mock_gen_aws_client.return_value = mock_client
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

        resp = self.client.post(
            self.setup_path,
            {"lambdaB": True},
            format="json",
            HTTP_ACCEPT="application/json",
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )

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
    @patch.object(PipelineView, "render_react_view", return_value=HttpResponse())
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
        mock_client = Mock()
        mock_gen_aws_client.return_value = mock_client
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

        resp = self.client.post(
            self.setup_path,
            {"lambdaB": True},
            format="json",
            HTTP_ACCEPT="application/json",
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )

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
    @patch.object(PipelineView, "render_react_view", return_value=HttpResponse())
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
        mock_client = Mock()
        mock_gen_aws_client.return_value = mock_client
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

        resp = self.client.post(
            self.setup_path,
            {"lambdaB": True},
            format="json",
            HTTP_ACCEPT="application/json",
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )

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
