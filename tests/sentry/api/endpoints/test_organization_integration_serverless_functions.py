from sentry.models import Integration, ProjectKey
from sentry.integrations.aws_lambda.integration import AwsLambdaIntegration
from sentry.testutils import APITestCase
from sentry.utils.compat.mock import patch, MagicMock
from sentry.testutils.helpers.faux import Mock


cloudformation_arn = (
    "arn:aws:cloudformation:us-east-2:599817902985:stack/"
    "Sentry-Monitoring-Stack-Filter/e42083d0-3e3f-11eb-b66a-0ac9b5db7f30"
)


class AbstractServerlessTest(APITestCase):
    endpoint = "sentry-api-0-organization-integration-serverless-functions"

    def setUp(self):
        super(AbstractServerlessTest, self).setUp()
        self.project = self.create_project(organization=self.organization)
        self.integration = Integration.objects.create(
            provider="aws_lambda",
            metadata={
                "region": "us-east-2",
                "account_number": "599817902985",
                "aws_external_id": "599817902985",
            },
        )
        self.org_integration = self.integration.add_organization(self.organization)
        self.org_integration.config = {"default_project_id": self.project.id}
        self.org_integration.save()
        self.login_as(self.user)

    def get_response(self, **kwargs):
        return super(AbstractServerlessTest, self).get_response(
            self.organization.slug, self.integration.id, **kwargs
        )

    @property
    def sentry_dsn(self):
        return ProjectKey.get_default(project=self.project).get_dsn(public=True)


class OrganizationIntegrationServerlessFunctionsGetTest(AbstractServerlessTest):
    method = "get"

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_basic(self, mock_gen_aws_client, mock_get_supported_functions):
        mock_get_supported_functions.return_value = [
            {
                "FunctionName": "lambdaA",
                "Runtime": "nodejs12.x",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaA",
                "Layers": [
                    {"Arn": "arn:aws:lambda:us-east-2:1234:layer:something-else:2"},
                    {"Arn": "arn:aws:lambda:us-east-2:1234:layer:my-layer:3"},
                ],
            },
            {
                "FunctionName": "lambdaD",
                "Runtime": "nodejs10.x",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaD",
                "Layers": [{"Arn": "arn:aws:lambda:us-east-2:1234:layer:something-else:2"}],
            },
            {
                "FunctionName": "lambdaB",
                "Runtime": "nodejs10.x",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaB",
                "Layers": [{"Arn": "arn:aws:lambda:us-east-2:1234:layer:my-layer:2"}],
            },
        ]
        assert self.get_response().data == [
            {
                "name": "lambdaA",
                "runtime": "nodejs12.x",
                "version": 3,
                "outOfDate": False,
                "enabled": True,
            },
            {
                "name": "lambdaB",
                "runtime": "nodejs10.x",
                "version": 2,
                "outOfDate": True,
                "enabled": True,
            },
            {
                "name": "lambdaD",
                "runtime": "nodejs10.x",
                "version": -1,
                "outOfDate": False,
                "enabled": False,
            },
        ]


class OrganizationIntegrationServerlessFunctionsPostTest(AbstractServerlessTest):
    method = "post"

    @patch.object(AwsLambdaIntegration, "get_serialized_lambda_function")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_enable(self, mock_gen_aws_client, mock_get_serialized_lambda_function):
        mock_client = Mock()
        mock_gen_aws_client.return_value = mock_client

        mock_client.get_function = MagicMock(
            return_value={
                "Configuration": {
                    "FunctionName": "lambdaD",
                    "Runtime": "nodejs10.x",
                    "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaD",
                    "Layers": ["arn:aws:lambda:us-east-2:1234:layer:something-else:2"],
                },
            }
        )
        mock_client.update_function_configuration = MagicMock()
        return_value = {
            "name": "lambdaD",
            "runtime": "nodejs10.x",
            "version": 3,
            "outOfDate": False,
            "enabled": True,
        }
        mock_get_serialized_lambda_function.return_value = return_value

        assert self.get_response(action="enable", target="lambdaD").data == return_value

        mock_client.get_function.assert_called_with(FunctionName="lambdaD")

        mock_client.update_function_configuration.assert_called_with(
            FunctionName="lambdaD",
            Layers=[
                "arn:aws:lambda:us-east-2:1234:layer:something-else:2",
                "arn:aws:lambda:us-east-2:1234:layer:my-layer:3",
            ],
            Environment={
                "Variables": {
                    "NODE_OPTIONS": "-r @sentry/serverless/dist/awslambda-auto",
                    "SENTRY_DSN": self.sentry_dsn,
                    "SENTRY_TRACES_SAMPLE_RATE": "1.0",
                }
            },
        )

    @patch.object(AwsLambdaIntegration, "get_serialized_lambda_function")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_disable(self, mock_gen_aws_client, mock_get_serialized_lambda_function):
        mock_client = Mock()
        mock_gen_aws_client.return_value = mock_client

        mock_client.get_function = MagicMock(
            return_value={
                "Configuration": {
                    "FunctionName": "lambdaD",
                    "Runtime": "nodejs10.x",
                    "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaD",
                    "Layers": [
                        {"Arn": "arn:aws:lambda:us-east-2:1234:layer:something-else:2"},
                        {"Arn": "arn:aws:lambda:us-east-2:1234:layer:my-layer:3"},
                    ],
                    "Environment": {
                        "Variables": {
                            "NODE_OPTIONS": "-r @sentry/serverless/dist/awslambda-auto",
                            "SENTRY_DSN": self.sentry_dsn,
                            "SENTRY_TRACES_SAMPLE_RATE": "1.0",
                            "OTHER": "hi",
                        }
                    },
                },
            }
        )
        mock_client.update_function_configuration = MagicMock()
        return_value = {
            "name": "lambdaD",
            "runtime": "nodejs10.x",
            "version": -1,
            "outOfDate": False,
            "enabled": False,
        }
        mock_get_serialized_lambda_function.return_value = return_value

        assert self.get_response(action="disable", target="lambdaD").data == return_value

        mock_client.get_function.assert_called_with(FunctionName="lambdaD")

        mock_client.update_function_configuration.assert_called_with(
            FunctionName="lambdaD",
            Layers=["arn:aws:lambda:us-east-2:1234:layer:something-else:2"],
            Environment={"Variables": {"OTHER": "hi"}},
        )

    @patch.object(AwsLambdaIntegration, "get_serialized_lambda_function")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_update_version(self, mock_gen_aws_client, mock_get_serialized_lambda_function):
        mock_client = Mock()
        mock_gen_aws_client.return_value = mock_client

        mock_client.get_function = MagicMock(
            return_value={
                "Configuration": {
                    "FunctionName": "lambdaD",
                    "Runtime": "nodejs10.x",
                    "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaD",
                    "Layers": [
                        {"Arn": "arn:aws:lambda:us-east-2:1234:layer:something-else:2"},
                        {"Arn": "arn:aws:lambda:us-east-2:1234:layer:my-layer:2"},
                    ],
                    "Environment": {
                        "Variables": {
                            "NODE_OPTIONS": "-r @sentry/serverless/dist/awslambda-auto",
                            "SENTRY_DSN": self.sentry_dsn,
                            "SENTRY_TRACES_SAMPLE_RATE": "1.0",
                            "OTHER": "hi",
                        }
                    },
                },
            }
        )
        mock_client.update_function_configuration = MagicMock()
        return_value = {
            "name": "lambdaD",
            "runtime": "nodejs10.x",
            "version": 3,
            "outOfDate": False,
            "enabled": True,
        }
        mock_get_serialized_lambda_function.return_value = return_value

        assert self.get_response(action="updateVersion", target="lambdaD").data == return_value

        mock_client.get_function.assert_called_with(FunctionName="lambdaD")

        mock_client.update_function_configuration.assert_called_with(
            FunctionName="lambdaD",
            Layers=[
                "arn:aws:lambda:us-east-2:1234:layer:something-else:2",
                "arn:aws:lambda:us-east-2:1234:layer:my-layer:3",
            ],
        )
