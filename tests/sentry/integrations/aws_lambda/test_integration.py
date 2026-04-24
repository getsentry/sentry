from typing import Any
from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError
from django.urls import reverse

from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.models.projectkey import ProjectKey
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test

account_number = "599817902985"
region = "us-east-2"
aws_external_id = "test-external-id-1234"


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
