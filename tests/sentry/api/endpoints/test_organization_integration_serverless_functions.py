from __future__ import absolute_import

from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.utils.compat.mock import patch


cloudformation_arn = (
    "arn:aws:cloudformation:us-east-2:599817902985:stack/"
    "Sentry-Monitoring-Stack-Filter/e42083d0-3e3f-11eb-b66a-0ac9b5db7f30"
)


class OrganizationIntegrationServerlessFunctionsTest(APITestCase):
    """Unit tests for emailing organization owners asking them to install an integration."""

    endpoint = "sentry-api-0-organization-integration-serverless-functions"
    method = "get"

    def setUp(self):
        super(OrganizationIntegrationServerlessFunctionsTest, self).setUp()
        self.integration = Integration.objects.create(
            provider="aws_lambda", metadata={"arn": cloudformation_arn, "aws_external_id": "213-32"}
        )
        self.integration.add_organization(self.organization)
        self.login_as(self.user)

    def get_response(self):
        return super(OrganizationIntegrationServerlessFunctionsTest, self).get_response(
            self.organization.slug, self.integration.id
        )

    @patch("sentry.integrations.aws_lambda.integration.get_supported_functions")
    @patch("sentry.integrations.aws_lambda.integration.gen_aws_client")
    def test_basic(self, mock_gen_aws_client, mock_get_supported_functions):
        mock_get_supported_functions.return_value = [
            {
                "FunctionName": "lambdaA",
                "Runtime": "nodejs12.x",
                "Layers": [
                    {"Arn": "arn:aws:lambda:us-east-2:1234:layer:something-else:2"},
                    {"Arn": "arn:aws:lambda:us-east-2:1234:layer:my-layer:3"},
                ],
            },
            {
                "FunctionName": "lambdaB",
                "Runtime": "nodejs10.x",
                "Layers": [{"Arn": "arn:aws:lambda:us-east-2:1234:layer:my-layer:2"}],
            },
            {
                "FunctionName": "lambdaD",
                "Runtime": "nodejs10.x",
                "Layers": [{"Arn": "arn:aws:lambda:us-east-2:1234:layer:something-else:2"}],
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
