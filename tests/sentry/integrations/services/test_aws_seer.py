from sentry.integrations.aws.client import AWS_NOT_CONFIGURED_MESSAGE
from sentry.integrations.aws.integration import get_cell_principal_arn
from sentry.integrations.services.aws_seer import aws_seer_service
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test

PRINCIPAL_ARN = "arn:aws:iam::987654321098:role/SeerWorkload"


@all_silo_test
class AwsSeerServiceTest(TestCase):
    def test_principal_arn_comes_from_cell(self) -> None:
        with self.options({"aws-seer.principal-arn": PRINCIPAL_ARN}):
            assert aws_seer_service.get_principal_arn(organization_id=self.organization.id) == (
                PRINCIPAL_ARN
            )
            assert get_cell_principal_arn(self.organization.id) == PRINCIPAL_ARN

    def test_principal_arn_is_none_when_cell_is_unconfigured(self) -> None:
        for value in ["", "arn:aws:iam::987654321098:user/not-a-role"]:
            with self.subTest(value=value), self.options({"aws-seer.principal-arn": value}):
                assert aws_seer_service.get_principal_arn(organization_id=self.organization.id) is (
                    None
                )
                with self.assertRaisesMessage(
                    IntegrationConfigurationError, AWS_NOT_CONFIGURED_MESSAGE
                ):
                    get_cell_principal_arn(self.organization.id)
