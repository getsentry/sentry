from botocore.exceptions import ClientError
from django.http import HttpResponse
from six.moves.urllib.parse import urlencode

from sentry.api.serializers import serialize
from sentry.integrations.aws_lambda import AwsLambdaIntegrationProvider
from sentry.integrations.aws_lambda.utils import ALL_AWS_REGIONS
from sentry.models import (
    Integration,
    OrganizationIntegration,
    ProjectKey,
)
from sentry.testutils import IntegrationTestCase
from sentry.utils.compat import map
from sentry.utils.compat.mock import patch, ANY, MagicMock
from sentry.testutils.helpers.faux import Mock
from sentry.pipeline import PipelineView


arn = (
    "arn:aws:cloudformation:us-east-2:599817902985:stack/"
    "Sentry-Monitoring-Stack-Filter/e42083d0-3e3f-11eb-b66a-0ac9b5db7f30"
)

account_number = "599817902985"
region = "us-east-2"


class AwsLambdaIntegrationTest(IntegrationTestCase):
    provider = AwsLambdaIntegrationProvider

    def setUp(self):
        super(AwsLambdaIntegrationTest, self).setUp()
        self.projectA = self.create_project(organization=self.organization, slug="projA")
        self.projectB = self.create_project(organization=self.organization, slug="projB")

    @patch.object(PipelineView, "render_react_view", return_value=HttpResponse())
    def test_project_select(self, mock_react_view):
        resp = self.client.get(self.setup_path)
        assert resp.status_code == 200
        serialized_projects = map(lambda x: serialize(x, self.user), [self.projectA, self.projectB])
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
                "stackName": "Sentry-Monitoring-Stack-Filter",
                "regionList": ALL_AWS_REGIONS,
                "region": None,
                "accountNumber": None,
                "error": None,
                "initialStepNumber": 1,
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
                "stackName": "Sentry-Monitoring-Stack-Filter",
                "regionList": ALL_AWS_REGIONS,
                "region": region,
                "accountNumber": account_number,
                "error": "Please validate the Cloudformation stack was created successfully",
                "initialStepNumber": 1,
            },
        )

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    @patch.object(PipelineView, "render_react_view", return_value=HttpResponse())
    def test_lambda_list(self, mock_react_view, mock_gen_aws_client, mock_get_supported_functions):
        mock_get_supported_functions.return_value = [
            {"FunctionName": "lambdaA", "Runtime": "nodejs12.x"},
            {"FunctionName": "lambdaB", "Runtime": "nodejs10.x"},
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

        resp = self.client.post(
            self.setup_path,
            {"lambdaB": True},
            format="json",
            HTTP_ACCEPT="application/json",
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )

        assert resp.status_code == 200

        mock_client.update_function_configuration.assert_called_with(
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
