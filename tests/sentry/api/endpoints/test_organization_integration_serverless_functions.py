from sentry.models import Integration, ProjectKey
from sentry.integrations.aws_lambda.integration import AwsLambdaIntegration
from sentry.testutils import APITestCase
from sentry.utils.compat.mock import patch, MagicMock
from sentry.testutils.helpers.faux import Mock


cloudformation_arn = (
    "arn:aws:cloudformation:us-east-2:599817902985:stack/"
    "Sentry-Monitoring-Stack/e42083d0-3e3f-11eb-b66a-0ac9b5db7f30"
)


class AbstractServerlessTest(APITestCase):
    endpoint = "sentry-api-0-organization-integration-serverless-functions"

    def setUp(self):
        super().setUp()
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
        return super().get_response(self.organization.slug, self.integration.id, **kwargs)

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

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_basic_python_functions(self, mock_gen_aws_client, mock_get_supported_functions):
        mock_get_supported_functions.return_value = [
            {
                "FunctionName": "lambdaA",
                "Runtime": "python3.6",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaA",
                "Layers": [
                    {"Arn": "arn:aws:lambda:us-east-2:1234:layer:something-else:2"},
                    {"Arn": "arn:aws:lambda:us-east-2:1234:layer:my-python-layer:34"},
                ],
                "Environment": {"Variables": {"SENTRY_INITIAL_HANDLER": "handler_string"}},
            },
            {
                "FunctionName": "lambdaD",
                "Runtime": "python3.8",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaD",
                "Layers": [{"Arn": "arn:aws:lambda:us-east-2:1234:layer:something-else:2"}],
            },
            {
                "FunctionName": "lambdaB",
                "Runtime": "python3.8",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaB",
                "Layers": [{"Arn": "arn:aws:lambda:us-east-2:1234:layer:my-python-layer:34"}],
            },
            {
                "FunctionName": "lambdaC",
                "Runtime": "python3.6",
                "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaC",
                "Layers": [
                    {"Arn": "arn:aws:lambda:us-east-2:1234:layer:something-else:2"},
                    {"Arn": "arn:aws:lambda:us-east-2:1234:layer:my-python-layer:22"},
                ],
                "Environment": {"Variables": {"SENTRY_INITIAL_HANDLER": "handler_string"}},
            },
        ]
        assert self.get_response().data == [
            {
                "name": "lambdaA",
                "runtime": "python3.6",
                "version": 34,
                "outOfDate": False,
                "enabled": True,
            },
            {
                "name": "lambdaB",
                "runtime": "python3.8",
                "version": -1,
                "outOfDate": False,
                "enabled": False,
            },
            {
                "name": "lambdaC",
                "runtime": "python3.6",
                "version": 22,
                "outOfDate": True,
                "enabled": True,
            },
            {
                "name": "lambdaD",
                "runtime": "python3.8",
                "version": -1,
                "outOfDate": False,
                "enabled": False,
            },
        ]


class OrganizationIntegrationServerlessFunctionsPostTest(AbstractServerlessTest):
    method = "post"

    @patch.object(AwsLambdaIntegration, "get_serialized_lambda_function")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_enable_node_layer(self, mock_gen_aws_client, mock_get_serialized_lambda_function):
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
    def test_enable_python_layer(self, mock_gen_aws_client, mock_get_serialized_lambda_function):
        mock_client = Mock()
        mock_gen_aws_client.return_value = mock_client

        mock_client.get_function = MagicMock(
            return_value={
                "Configuration": {
                    "FunctionName": "lambdaE",
                    "Runtime": "python3.8",
                    "Handler": "lambda_handler.test_handler",
                    "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaE",
                    "Layers": ["arn:aws:lambda:us-east-2:1234:layer:something-else:2"],
                },
            }
        )
        mock_client.update_function_configuration = MagicMock()
        return_value = {
            "name": "lambdaE",
            "runtime": "python3.8",
            "version": 3,
            "outOfDate": False,
            "enabled": True,
        }
        mock_get_serialized_lambda_function.return_value = return_value

        assert self.get_response(action="enable", target="lambdaE").data == return_value

        mock_client.get_function.assert_called_with(FunctionName="lambdaE")

        mock_client.update_function_configuration.assert_called_with(
            FunctionName="lambdaE",
            Layers=[
                "arn:aws:lambda:us-east-2:1234:layer:something-else:2",
                "arn:aws:lambda:us-east-2:1234:layer:my-python-layer:34",
            ],
            Environment={
                "Variables": {
                    "SENTRY_INITIAL_HANDLER": "lambda_handler.test_handler",
                    "SENTRY_DSN": self.sentry_dsn,
                    "SENTRY_TRACES_SAMPLE_RATE": "1.0",
                }
            },
            Handler="sentry_sdk.integrations.init_serverless_sdk.sentry_lambda_handler",
        )

    @patch.object(AwsLambdaIntegration, "get_serialized_lambda_function")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_disable_node(self, mock_gen_aws_client, mock_get_serialized_lambda_function):
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
    def test_disable_python(self, mock_gen_aws_client, mock_get_serialized_lambda_function):
        mock_client = Mock()
        mock_gen_aws_client.return_value = mock_client

        mock_client.get_function = MagicMock(
            return_value={
                "Configuration": {
                    "FunctionName": "lambdaF",
                    "Runtime": "python3.6",
                    "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaF",
                    "Handler": "sentry_sdk.integrations.init_serverless_sdk.sentry_lambda_handler",
                    "Layers": [
                        {"Arn": "arn:aws:lambda:us-east-2:1234:layer:something-else:2"},
                        {"Arn": "arn:aws:lambda:us-east-2:1234:layer:my-python-layer:34"},
                    ],
                    "Environment": {
                        "Variables": {
                            "SENTRY_INITIAL_HANDLER": "lambda_handler.test_handler",
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
            "name": "lambdaF",
            "runtime": "python3.6",
            "version": -1,
            "outOfDate": False,
            "enabled": False,
        }
        mock_get_serialized_lambda_function.return_value = return_value

        assert self.get_response(action="disable", target="lambdaF").data == return_value

        mock_client.get_function.assert_called_with(FunctionName="lambdaF")

        mock_client.update_function_configuration.assert_called_with(
            FunctionName="lambdaF",
            Layers=["arn:aws:lambda:us-east-2:1234:layer:something-else:2"],
            Environment={"Variables": {"OTHER": "hi"}},
            Handler="lambda_handler.test_handler",
        )

    @patch.object(AwsLambdaIntegration, "get_serialized_lambda_function")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_update_node_version(self, mock_gen_aws_client, mock_get_serialized_lambda_function):
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

    @patch.object(AwsLambdaIntegration, "get_serialized_lambda_function")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_update_python_version(self, mock_gen_aws_client, mock_get_serialized_lambda_function):
        mock_client = Mock()
        mock_gen_aws_client.return_value = mock_client

        mock_client.get_function = MagicMock(
            return_value={
                "Configuration": {
                    "FunctionName": "lambdaG",
                    "Runtime": "python3.6",
                    "Handler": "sentry_sdk.integrations.init_serverless_sdk.sentry_lambda_handler",
                    "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaG",
                    "Layers": [
                        {"Arn": "arn:aws:lambda:us-east-2:1234:layer:something-else:2"},
                        {"Arn": "arn:aws:lambda:us-east-2:1234:layer:my-python-layer:2"},
                    ],
                    "Environment": {
                        "Variables": {
                            "SENTRY_INITIAL_HANDLER": "lambda_test.lambda_handler",
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
            "name": "lambdaG",
            "runtime": "python3.8",
            "version": 3,
            "outOfDate": False,
            "enabled": True,
        }
        mock_get_serialized_lambda_function.return_value = return_value

        assert self.get_response(action="updateVersion", target="lambdaG").data == return_value

        mock_client.get_function.assert_called_with(FunctionName="lambdaG")

        mock_client.update_function_configuration.assert_called_with(
            FunctionName="lambdaG",
            Layers=[
                "arn:aws:lambda:us-east-2:1234:layer:something-else:2",
                "arn:aws:lambda:us-east-2:1234:layer:my-python-layer:34",
            ],
        )

    @patch.object(AwsLambdaIntegration, "get_serialized_lambda_function")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_enable_python_layer_on_already_enabled(
        self, mock_gen_aws_client, mock_get_serialized_lambda_function
    ):
        """
        Test that ensures that if sentry-sdk is already enabled, then
        re-enabling it should not override the env variables since it could be
        problematic since the SENTRY_INITIAL_HANDLER env variable could be overriden
        the second time with "sentry_sdk.integrations.init_serverless_sdk.
        sentry_lambda_handler" and then disabling the sentry-sdk, would break
        the function because the Handler will be updated with an incorrect
        SENTRY_INITIAL_HANDLER value
        """
        mock_client = Mock()
        mock_gen_aws_client.return_value = mock_client

        mock_client.get_function = MagicMock(
            return_value={
                "Configuration": {
                    "FunctionName": "lambdaZ",
                    "Runtime": "python3.8",
                    "Handler": "sentry_sdk.integrations.init_serverless_sdk.sentry_lambda_handler",
                    "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaZ",
                    "Layers": [
                        "arn:aws:lambda:us-east-2:1234:layer:something-else:2",
                        "arn:aws:lambda:us-east-2:1234:layer:my-python-layer:34",
                    ],
                    "Environment": {
                        "Variables": {
                            "SENTRY_INITIAL_HANDLER": "lambda_handler.test_handler",
                            "SENTRY_DSN": self.sentry_dsn,
                            "SENTRY_TRACES_SAMPLE_RATE": "1.0",
                        }
                    },
                },
            }
        )
        mock_client.update_function_configuration = MagicMock()
        return_value = {
            "name": "lambdaZ",
            "runtime": "python3.8",
            "version": 3,
            "outOfDate": False,
            "enabled": True,
        }
        mock_get_serialized_lambda_function.return_value = return_value

        assert self.get_response(action="enable", target="lambdaZ").data == return_value

        mock_client.get_function.assert_called_with(FunctionName="lambdaZ")

        mock_client.update_function_configuration.assert_called_with(
            FunctionName="lambdaZ",
            Layers=[
                "arn:aws:lambda:us-east-2:1234:layer:something-else:2",
                "arn:aws:lambda:us-east-2:1234:layer:my-python-layer:34",
            ],
            Environment={
                "Variables": {
                    "SENTRY_INITIAL_HANDLER": "lambda_handler.test_handler",
                    "SENTRY_DSN": self.sentry_dsn,
                    "SENTRY_TRACES_SAMPLE_RATE": "1.0",
                }
            },
            Handler="sentry_sdk.integrations.init_serverless_sdk.sentry_lambda_handler",
        )
